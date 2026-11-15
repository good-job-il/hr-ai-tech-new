import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testDatabase, actAs } from './support/database.mjs';

test('CV metadata can be listed but raw download, signing and S3 bytes are blocked; RPC enforces current grant', async () => {
  const pg = await testDatabase();
  try {
    const admin = 'c1000000-0000-4000-8000-000000000001', recruiter = 'c1000000-0000-4000-8000-000000000002';
    await pg.query('insert into auth.users(id) values($1),($2)', [admin, recruiter]);
    await actAs(pg, admin);
    const org = (await pg.query("select create_organization('CV server QA','agency') id")).rows[0].id;
    await pg.query("select set_member_role($1,$2,'recruitment_coordinator')", [org, recruiter]);
    const candidate = (await pg.query("insert into candidates(organization_id,owner_id,full_name,email,visibility) values($1,$2,'Synthetic','qa@example.invalid','shared') returning id", [org, admin])).rows[0].id;
    const path = `${org}/${candidate}/fixture.pdf`, ownPath = `${recruiter}/own.pdf`;
    const doc = (await pg.query("insert into candidate_documents(organization_id,candidate_id,object_path,label,uploaded_by) values($1,$2,$3,'QA.pdf',$4) returning id", [org, candidate, path, admin])).rows[0].id;
    await pg.exec('reset role');
    await pg.query("insert into storage.objects(bucket_id,name) values('organization-cvs',$1),('candidate-cvs',$2)", [path, ownPath]);
    await actAs(pg, recruiter);
    await assert.rejects(pg.query('select candidate_document_download($1)', [doc]), /Not permitted/);
    assert.equal((await pg.query('select candidate_cv_download($1) path', [ownPath])).rows[0].path, ownPath);
    await assert.rejects(pg.query('select candidate_cv_download($1)', [`${admin}/own.pdf`]), /Not permitted/);
    await actAs(pg, admin);
    await pg.query("select set_member_permission($1,$2,'cv.download',true)", [org, recruiter]);
    await actAs(pg, recruiter);
    assert.equal((await pg.query('select candidate_document_download($1) path', [doc])).rows[0].path, path);
    for (const operation of ['object.get_authenticated', 'object.sign', 'object.sign_many', 's3.object.get', 'object.copy', 'unknown']) {
      await pg.query("select set_config('storage.operation',$1,false)", [operation]);
      assert.equal((await pg.query("select name from storage.objects where bucket_id in ('organization-cvs','candidate-cvs')")).rows.length, 0, operation);
    }
    await pg.query("select set_config('storage.operation','object.list',false)");
    assert.equal((await pg.query('select name from storage.objects')).rows.length, 2);
    await actAs(pg, admin);
    await pg.query("select set_member_permission($1,$2,'cv.download',false)", [org, recruiter]);
    await actAs(pg, recruiter);
    await assert.rejects(pg.query('select candidate_document_download($1)', [doc]), /Not permitted/);
  } finally { await pg.close(); }
});
