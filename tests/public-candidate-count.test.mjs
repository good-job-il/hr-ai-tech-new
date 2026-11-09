import {test} from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './support/database.mjs';

test('Public candidate total counts confirmed registrations without profiles and excludes test/business/deleted accounts',async()=>{
 const pg=await testDatabase();
 try{
  const add=async(email,type,confirmed=true,app={},deleted=false)=>{const r=await pg.query(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data,deleted_at) values(gen_random_uuid(),$1,case when $2 then now() end,$3,$4,case when $5 then now() end) returning id`,[email,confirmed,JSON.stringify({account_type:type,contact_phone:'+12025550101'}),JSON.stringify(app),deleted]);return r.rows[0].id;};
  await add('first@real-company.co.il','candidate');
  const pending=await add('second@real-company.co.il','candidate',false);
  await add('business@real-company.co.il','employer');
  await add('qa@real-company.co.il','candidate',true,{is_test:true});
  await add('removed@real-company.co.il','candidate',true,{},true);
  for(const domain of ['example.invalid','fixture.test','example.com','sub.example.org','example.net'])await add('qa@'+domain,'candidate');
  await pg.exec('set role anon');
  const count=async()=>Number((await pg.query('select public_registered_candidate_count() n')).rows[0].n);
  assert.equal(await count(),1);
  await assert.rejects(pg.query('select email from auth.users'));
  await assert.rejects(pg.query(`select public_registered_candidate_count('someone@real-company.co.il')`));
  await pg.exec('reset role');await pg.query('update auth.users set email_confirmed_at=now() where id=$1',[pending]);
  await pg.exec('set role anon');assert.equal(await count(),2);
  await pg.exec('reset role');await pg.query(`update auth.users set raw_app_meta_data='{"is_test":true}' where id=$1`,[pending]);
  await pg.exec('set role authenticated');assert.equal(await count(),1);
 }finally{await pg.close()}
});
