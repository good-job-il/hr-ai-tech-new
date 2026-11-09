import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {testDatabase,actAs} from './support/database.mjs';

test('Existing published active roles survive old verification dates across public paths; closing and review still hide them',async()=>{
 const pg=await testDatabase();
 try{
  // Reproduce the deployed legacy policy/view, then upgrade existing rows.
  const legacy=await readFile(new URL('../supabase/migrations/046_client_pilot.sql',import.meta.url),'utf8');
  await pg.exec(legacy.slice(legacy.indexOf('create or replace view public.public_job_catalog'),legacy.indexOf('create table public.pilot_source_jobs')));
  await pg.exec("alter policy external_jobs_read on public.external_jobs using(publication_status='published' and status='active' and verified_at<=now()+interval '5 minutes' and verified_at>now()-interval '7 days')");
  const admin='d1000000-0000-4000-8000-000000000001',candidate='d1000000-0000-4000-8000-000000000002',privateCandidate='d1000000-0000-4000-8000-000000000003';
  for(const id of [admin,candidate,privateCandidate])await pg.query('insert into auth.users(id) values($1)',[id]);
  await pg.query('insert into platform_admins(user_id) values($1)',[admin]);
  await pg.exec("insert into job_sources values('visibility-fixture','Fixture company','https://example.invalid')");
  const ids={};
  for(const [title,status,publication,date] of [
   ['old','active','published',"now()-interval '365 days'"],
   ['eight-days','active','published',"now()-interval '8 days'"],
   ['fresh','active','published','now()'],
   ['closed','closed','published',"now()-interval '30 days'"],
   ['draft','active','draft',"now()-interval '30 days'"],
   ['review','active','review',"now()-interval '30 days'"],
   ['unverified','active','published','null'],
   ['future','active','published',"now()+interval '1 day'"],
  ])ids[title]=(await pg.query(`insert into external_jobs(source_id,source_url,title,location,description,status,publication_status,verified_at,verification_method) values('visibility-fixture',$1,$2,'Israel',$3,$4,$5,${date},'public-html') returning id`,['https://example.invalid/'+title,title,'A'.repeat(300)+' visibility-needle',status,publication])).rows[0].id;
  const original=(await pg.query('select verified_at from external_jobs where id=$1',[ids.old])).rows[0].verified_at;
  await pg.exec('set role anon');
  assert.deepEqual((await pg.query('select id from public_job_catalog')).rows,[{id:ids.fresh}]);
  await pg.exec('reset role');
  await pg.exec(await readFile(new URL('../supabase/migrations/060_active_jobs_do_not_expire.sql',import.meta.url),'utf8'));
  await pg.exec('set role anon');
  const expected=[ids.old,ids['eight-days'],ids.fresh].sort();
  assert.deepEqual((await pg.query('select id from public_job_catalog')).rows.map(r=>r.id).sort(),expected);
  assert.deepEqual((await pg.query('select id from external_jobs')).rows.map(r=>r.id).sort(),expected);
  assert.deepEqual((await pg.query("select id from search_public_job_ids('visibility-needle')")).rows.map(r=>r.id).sort(),expected);
  assert.equal((await pg.query('select description from external_jobs where id=$1',[ids.old])).rows[0].description.length>280,true);
  await assert.rejects(pg.query('select source_url from external_jobs'),/permission denied/);
  await assert.rejects(pg.query('select set_external_publication($1,true)',[ids.draft]),/permission denied/);
  await actAs(pg,candidate);
  assert.deepEqual((await pg.query('select id from public_job_catalog')).rows.map(r=>r.id).sort(),expected);
  await pg.query('insert into saved_jobs(user_id,external_job_id) values($1,$2)',[candidate,ids.old]);
  await pg.query("insert into applications(candidate_id,external_job_id,cover_letter) values($1,$2,'Fixture application')",[candidate,ids.old]);
  await assert.rejects(pg.query('select set_external_publication($1,true)',[ids.draft]),/Not permitted/);
  await pg.query("insert into candidate_profiles(user_id,full_name,share_success_story) values($1,'Consenting fixture',true)",[candidate]);
  await actAs(pg,privateCandidate);
  await pg.query("insert into applications(candidate_id,external_job_id,cover_letter) values($1,$2,'Private fixture application')",[privateCandidate,ids.old]);
  await pg.query("insert into candidate_profiles(user_id,full_name,share_success_story) values($1,'Private fixture',false)",[privateCandidate]);
  await actAs(pg,admin);
  await pg.query("update applications set status='hired' where external_job_id=$1",[ids.old]);
  await pg.query('select set_external_publication($1,true)',[ids.draft]);
  for(const key of ['closed','unverified','future'])await assert.rejects(pg.query('select set_external_publication($1,true)',[ids[key]]),/requires verification/);
  await pg.exec('reset role;set role anon');
  assert.deepEqual((await pg.query('select * from public_candidate_examples($1,true)',[ids.old])).rows.map(r=>r.display_name),['Consenting fixture']);
  await pg.exec('reset role');
  assert.equal((await pg.query('select verified_at from external_jobs where id=$1',[ids.old])).rows[0].verified_at.toISOString(),original.toISOString());
  await pg.query("update external_jobs set status='closed' where id=$1",[ids.old]);
  await pg.exec('set role anon');
  assert.equal((await pg.query('select id from public_job_catalog where id=$1',[ids.old])).rows.length,0);
  assert.equal((await pg.query('select id from external_jobs where id=$1',[ids.old])).rows.length,0);
  assert.equal((await pg.query('select * from public_candidate_examples($1,true)',[ids.old])).rows.length,0);
  await actAs(pg,admin);
  await pg.query('select set_external_publication($1,false)',[ids.draft]);
  await pg.exec('reset role;set role anon');
  assert.equal((await pg.query('select id from public_job_catalog where id=$1',[ids.draft])).rows.length,0);
 }finally{await pg.close()}
});
