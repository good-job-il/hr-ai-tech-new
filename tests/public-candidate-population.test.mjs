import {test} from 'node:test';import assert from 'node:assert/strict';
import {testDatabase} from './support/database.mjs';

test('Public population deduplicates imported pools and confirmed accounts without exposing any identity',async()=>{
 const pg=await testDatabase();try{
  const user=async(email,type='candidate',confirmed=true,app={})=>(await pg.query(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data) values(gen_random_uuid(),$1,case when $2 then now() end,$3,$4) returning id`,[email,confirmed,JSON.stringify({account_type:type,contact_phone:type==='candidate'?'':'+12025550101'}),JSON.stringify(app)])).rows[0].id;
  const owner=await user('owner@business.co.il');
  const org=async(name,isTest=false)=>(await pg.query(`insert into organizations(id,name,kind,is_test) values(gen_random_uuid(),$1,'agency',$2) returning id`,[name,isTest])).rows[0].id;
  const a=await org('Pool A'),b=await org('Pool B'),qa=await org('QA',true);
  const card=async(o,email,phone='',name='Same name')=>(await pg.query(`insert into candidates(organization_id,owner_id,created_by,full_name,email,phone) values($1,$2,$2,$3,$4,$5) returning id`,[o,owner,name,email,phone])).rows[0].id;
  await card(a,'one@people.co.il','0508234567');
  await card(b,'other-email@people.co.il','+972508234567');
  await card(b,'one@people.co.il'); // email-only copy joins the existing phone
  await user('one@people.co.il'); // registration without a profile is the same person
  await card(a,'','0528234567');
  const byPhone=await user('phone-account@people.co.il');
  await pg.query(`update account_settings set contact_phone='528234567' where user_id=$1`,[byPhone]);
  await card(a,'email-only@people.co.il');await card(b,' EMAIL-ONLY@PEOPLE.CO.IL ');
  await user('brand-new@people.co.il');
  const pending=await user('pending@people.co.il','candidate',false);
  await user('employer@people.co.il','employer');
  const test=await user('qa-real-domain@people.co.il','candidate',true,{is_test:true});
  await card(a,'qa-real-domain@people.co.il','0548234567');
  await card(qa,'qa-pool@people.co.il','0558234567');
  await card(a,'qa@example.invalid','0568234567');await user('qa@example.test');
  const merged=await card(a,'merged@people.co.il');
  await pg.query('update candidates set merged_into=$1 where id=$2',[(await pg.query('select id from candidates where organization_id=$1 and email=$2',[a,'one@people.co.il'])).rows[0].id,merged]);
  const deleted=await user('deleted@people.co.il');await pg.query('update auth.users set deleted_at=now() where id=$1',[deleted]);
  const count=async()=>Number((await pg.query('select public_candidate_population_count() n')).rows[0].n);
  await pg.exec('set role anon');assert.equal(await count(),5); // owner + four contact identities
  await assert.rejects(pg.query('select email from auth.users'));
  await assert.rejects(pg.query('select email from candidates'));
  await assert.rejects(pg.query("select public_candidate_population_count('one@people.co.il')"));
  await pg.exec('reset role');await pg.query('update auth.users set email_confirmed_at=now() where id=$1',[pending]);
  await pg.exec('set role authenticated');assert.equal(await count(),6);
  await pg.exec('reset role');
  await card(a,'shared@people.co.il','0588234567');await card(b,'shared@people.co.il','0598234567');
  assert.equal(await count(),8); // documented phone precedence: shared email cannot merge conflicting phones
  assert(test); // test account was created and explicitly excluded
 }finally{await pg.close()}
});
