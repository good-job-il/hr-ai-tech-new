import {test} from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './support/database.mjs';
test('Imported job can leave work mode unknown without accepting arbitrary values',async()=>{
 const pg=await testDatabase();
 try{
  await pg.exec("insert into public.organizations(id,name,kind) values('00000000-0000-0000-0000-000000000002','Fixture agency','agency')");
  await pg.exec("insert into public.jobs(organization_id,title,location,description,type,work_mode,is_public) values('00000000-0000-0000-0000-000000000002','Imported position','Not provided','Published source description','unspecified','',false)");
  assert.equal((await pg.query('select work_mode from public.jobs')).rows[0].work_mode,'');
  await assert.rejects(pg.exec("update public.jobs set work_mode='invented'"));
 }finally{await pg.close()}
});
