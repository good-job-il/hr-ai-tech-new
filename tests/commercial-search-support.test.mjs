import {test} from 'node:test';import assert from 'node:assert/strict';import {testDatabase,actAs} from './support/database.mjs';
test('Commercial benefits, retries, organization isolation, employer search and private screenshots',async()=>{
 const pg=await testDatabase();try{
 const admin='ed000000-0000-4000-8000-000000000001',owner='ed000000-0000-4000-8000-000000000002',other='ed000000-0000-4000-8000-000000000003',recruiter='ed000000-0000-4000-8000-000000000004';
 await pg.query("insert into auth.users(id,email,email_confirmed_at) values($1,'admin@example.invalid',now()),($2,'owner@example.invalid',now()),($3,'other@example.invalid',now()),($4,'recruiter@example.invalid',now())",[admin,owner,other,recruiter]);
 await pg.query('insert into platform_admins(user_id) values($1)',[admin]);
 await actAs(pg,owner);const org=(await pg.query("select create_organization('Isolated A','agency') id")).rows[0].id;
 await actAs(pg,other);const org2=(await pg.query("select create_organization('Isolated B','employer') id")).rows[0].id;
 await pg.exec('reset role');await pg.query("insert into memberships(organization_id,user_id,role) values($1,$2,'recruitment_coordinator')",[org,recruiter]);
 await actAs(pg,owner);await assert.rejects(pg.query("select adjust_commercial_account($1,30,'days',20,'unauthorized',gen_random_uuid())",[org]),/Not permitted/);
 await actAs(pg,admin);const key='ed000000-0000-4000-8000-000000000005';
 await pg.query("select adjust_commercial_account($1,30,'days',20,'Pilot benefit',$2)",[org,key]);
 await pg.query("select adjust_commercial_account($1,30,'days',20,'Pilot benefit',$2)",[org,key]);
 let d=(await pg.query('select commercial_account_data($1) d',[org])).rows[0].d;
 assert.equal(d.account.application_balance,20);assert.equal(d.count,1);assert.equal(d.account.money_agorot,0);
 await assert.rejects(pg.query("select adjust_commercial_account($1,30,'days',30,'Pilot benefit',$2)",[org,key]),/IDEMPOTENCY_CONFLICT/);
 await assert.rejects(pg.query("select adjust_commercial_account($1,-1,'days',0,'Bad',gen_random_uuid())",[org]),/INVALID_ADJUSTMENT/);
 await assert.rejects(pg.query("select adjust_commercial_account($1,1,'hours',0,'Bad',gen_random_uuid())",[org]),/INVALID_ADJUSTMENT/);
 await pg.exec('reset role');await pg.query("update commercial_accounts set trial_until='2028-01-31 12:00:00+02' where organization_id=$1",[org]);
 await actAs(pg,admin);await pg.query("select adjust_commercial_account($1,1,'months',0,'Calendar month',gen_random_uuid())",[org]);
 d=(await pg.query('select commercial_account_data($1) d',[org])).rows[0].d;
 assert.ok(d.account.trial_until.startsWith('2028-02-29'));
 await pg.query("select adjust_commercial_account($1,0,'days',5,'Quota only',gen_random_uuid())",[org]);
 const after=(await pg.query('select commercial_account_data($1) d',[org])).rows[0].d;assert.equal(after.account.trial_until,d.account.trial_until);assert.equal(after.account.application_balance,25);
 await actAs(pg,owner);assert.equal((await pg.query('select commercial_account_data($1) d',[org])).rows[0].d.account.application_balance,25);
 await assert.rejects(pg.query('select commercial_account_data($1)',[org2]),/Not permitted/);
 await assert.rejects(pg.query('select commercial_overview()'),/Not permitted/);
 await assert.rejects(pg.query('update commercial_accounts set application_balance=900 where organization_id=$1',[org]),/permission denied/);
 await actAs(pg,recruiter);await assert.rejects(pg.query('select commercial_account_data($1)',[org]),/Not permitted/);assert.equal((await pg.query('select count(*) n from commercial_events')).rows[0].n,0);
 await pg.exec('reset role');await pg.query("update commercial_accounts set trial_until=now()+interval '5 days' where organization_id=$1",[org]);
 await actAs(pg,owner);let notice=(await pg.query('select commercial_trial_reminder($1) d',[org])).rows[0].d;assert.equal(notice.threshold,5);await pg.query('select commercial_trial_reminder($1)',[org]);assert.equal((await pg.query('select count(*) n from commercial_trial_notices')).rows[0].n,1);
 await pg.exec('reset role');await pg.query('update commercial_accounts set monthly_price_agorot=34900,money_agorot=34900 where organization_id=$1',[org]);
 await actAs(pg,owner);assert.equal((await pg.query('select commercial_trial_reminder($1) d',[org])).rows[0].d,null);
 // Company search uses recorded experience in this organization's RLS-filtered pool.
 const candidate=(await pg.query("insert into candidates(organization_id,owner_id,full_name,email,visibility) values($1,$2,'Test accountant','person@example.invalid','shared') returning id",[org,owner])).rows[0].id;
 await pg.query("select save_candidate_professional($1,'{\"current_company\":\"Current employer\",\"previous_companies\":\"Previous employer\",\"city\":\"Haifa\",\"region\":\"North\",\"skills\":\"Excel\",\"experience_years\":5,\"salary_min\":10000}')",[candidate]);
 await pg.query("select set_candidate_interest($1,'Accountant','Finance')",[candidate]);
 const search=async filters=>(await pg.query('select search_candidate_pool($1,$2::jsonb,0) d',[org,JSON.stringify(filters)])).rows[0].d;
 assert.equal((await search({company:'Current',company_scope:'current',role:'Accountant',domain:'Finance',skill:'Excel',region:'North',experience_max:'6',salary_ceiling:'12000'})).count,1);
 assert.equal((await search({company:'Previous',company_scope:'current'})).count,0);
 assert.equal((await search({company:'Previous',company_scope:'previous'})).count,1);
 assert.equal((await search({company:"' OR true --"})).count,0);
 await actAs(pg,other);assert.equal((await pg.query("select search_candidate_pool($1,'{}',0) d",[org2])).rows[0].d.count,0);await assert.rejects(pg.query("select search_candidate_pool($1,'{}',0)",[org]),/Not permitted/);
 // Only the requester and platform support can read screenshot records and their storage objects.
 await actAs(pg,owner);const ticket=(await pg.query("insert into support_tickets(user_id,category,subject,body) values($1,'help','Help','Description') returning id",[owner])).rows[0].id;const path=ticket+'/test.png';
 await pg.query("insert into storage.objects(bucket_id,name) values('support-screenshots',$1)",[path]);await pg.query('insert into support_screenshots(ticket_id,uploaded_by,object_path) values($1,$2,$3)',[ticket,owner,path]);
 assert.equal((await pg.query("select count(*) n from storage.objects where bucket_id='support-screenshots'")).rows[0].n,1);
 await actAs(pg,other);assert.equal((await pg.query('select count(*) n from support_screenshots')).rows[0].n,0);assert.equal((await pg.query("select count(*) n from storage.objects where bucket_id='support-screenshots'")).rows[0].n,0);
 await assert.rejects(pg.query("insert into storage.objects(bucket_id,name) values('support-screenshots',$1)",[ticket+'/bad.png']),/row-level security/);
 await actAs(pg,admin);assert.equal((await pg.query('select count(*) n from support_screenshots')).rows[0].n,1);
 }finally{await pg.close()}
});
