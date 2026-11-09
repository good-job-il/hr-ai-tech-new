import {test} from 'node:test';import assert from 'node:assert/strict';
import {countHiringCompanies} from '../lib/hiring-company-count.mjs';
import {testDatabase,actAs} from './support/database.mjs';

test('Hiring companies count distinct public employer labels, not vacancies or source IDs',()=>{
 assert.equal(countHiringCompanies([]),0);
 assert.equal(countHiringCompanies([{organization:{name:'Acme Tech'}},{organization:{name:'  ACME  TECH\n'}},{organization:{name:'מַכָּבִּי'}},{organization:{name:'מכבי'}},{organization:{name:''}},{organization:null},{}]),2);
});

test('Hiring count follows anonymous catalog: QA/private/closed/draft companies excluded and old active jobs retained',async()=>{
 const pg=await testDatabase();try{
  const owner='c3000000-0000-4000-8000-000000000001';await pg.query('insert into auth.users(id) values($1)',[owner]);await actAs(pg,owner);
  const org=(await pg.query("select create_organization('Real Company','employer') id")).rows[0].id;
  await pg.query("insert into jobs(organization_id,title,location,type,description) values($1,'Role A','Israel','full-time','Synthetic'),($1,'Role B','Israel','full-time','Synthetic')",[org]);
  await pg.exec('reset role');
  const hidden=(await pg.query("insert into organizations(id,name,kind) values(gen_random_uuid(),'Private Company','employer') returning id")).rows[0].id;
  await pg.query("insert into jobs(organization_id,title,location,type,description,is_public) values($1,'Private','Israel','full-time','Synthetic',false)",[hidden]);
  await pg.exec('reset role');
  await pg.query("insert into organizations(id,name,kind,is_test) values('c3000000-0000-4000-8000-000000000002','QA Company','employer',true)");
  await pg.query("insert into jobs(organization_id,title,location,type,description) values('c3000000-0000-4000-8000-000000000002','QA','Israel','full-time','Synthetic')");
  await pg.query("insert into job_sources(id,company,career_url) values('hiring-a','External Company','https://example.invalid/a'),('hiring-b',' EXTERNAL  COMPANY ','https://example.invalid/b'),('hiring-none','No published roles','https://example.invalid/none')");
  await pg.query("insert into external_jobs(source_id,source_url,title,location,description,verified_at,verification_method,publication_status) values('hiring-a','https://example.invalid/a/1','A','Israel','Synthetic',now()-interval '30 days','public-html','published'),('hiring-b','https://example.invalid/b/1','B','Israel','Synthetic',now(),'public-html','published'),('hiring-none','https://example.invalid/none/1','Draft','Israel','Synthetic',now(),'public-html','draft')");
  const count=async()=>countHiringCompanies((await pg.query('select company from public_job_catalog')).rows.map(r=>({organization:{name:r.company}})));
  await pg.exec('set role anon');assert.equal(await count(),2);
  await pg.exec('reset role');await pg.query("update jobs set status='closed' where organization_id=$1",[org]);
  await pg.exec('set role anon');assert.equal(await count(),1);
  await pg.exec('reset role');await pg.query("update external_jobs set status='closed' where source_id in('hiring-a','hiring-b')");
  await pg.exec('set role anon');assert.equal(await count(),0);
 }finally{await pg.close()}
});
