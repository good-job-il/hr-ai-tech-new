import {test} from 'node:test';import assert from 'node:assert/strict';
import {testDatabase,actAs} from './support/database.mjs';
import {readFile} from 'node:fs/promises';

test('Client queue hides every answered referral, enforces agency reasons and retains agency history across deliberate re-shares',async()=>{
 const pg=await testDatabase();try{
 const manager='d2000000-0000-4000-8000-000000000001',clientUser='d2000000-0000-4000-8000-000000000002',other='d2000000-0000-4000-8000-000000000003';
 await pg.query("insert into auth.users(id,email,email_confirmed_at) values($1,'inbox-admin@example.invalid',now()),($2,'inbox-client@example.invalid',now()),($3,'inbox-other@example.invalid',now())",[manager,clientUser,other]);
 await actAs(pg,manager);const org=(await pg.query("select create_organization('Inbox QA','agency') id")).rows[0].id;
 const client=(await pg.query("insert into agency_clients(organization_id,name) values($1,'Inbox QA client') returning id",[org])).rows[0].id;
 await pg.query("select set_client_portal_member($1,'inbox-client@example.invalid',true)",[client]);
 const job=(await pg.query("insert into jobs(organization_id,title,location,type,description,client_id,is_public) values($1,'QA role','Test','full-time','QA',$2,false) returning id",[org,client])).rows[0].id;
 const candidate=(await pg.query("insert into candidates(organization_id,owner_id,full_name,email,visibility) values($1,$2,'Synthetic Candidate','private-inbox@example.invalid','shared') returning id",[org,manager])).rows[0].id;
 const placement=(await pg.query("insert into candidate_placements(organization_id,candidate_id,job_id,created_by,notes) values($1,$2,$3,$4,'INTERNAL MUST STAY PRIVATE') returning id",[org,candidate,job,manager])).rows[0].id;
 await pg.query('select request_candidate_submission($1)',[placement]);const submission=(await pg.query('select id from candidate_submissions where placement_id=$1',[placement])).rows[0].id;
 const path=org+'/'+candidate+'/qa.pdf';const doc=(await pg.query("insert into candidate_documents(organization_id,candidate_id,object_path,label,uploaded_by) values($1,$2,$3,'Synthetic.pdf',$4) returning id",[org,candidate,path,manager])).rows[0].id;
 await pg.query("insert into storage.objects(bucket_id,name) values('organization-cvs',$1)",[path]);
 const share=(await pg.query("select share_candidate_portal($1,'QA approved summary',$2) id",[submission,doc])).rows[0].id;
 await pg.exec('reset role');
 const approved=(await pg.query("insert into organization_rejection_reasons(organization_id,label,label_en) values($1,'סיבת בדיקה מאושרת','Approved test reason') returning id",[org])).rows[0].id;
 const inactive=(await pg.query("insert into organization_rejection_reasons(organization_id,label,active) values($1,'סיבת בדיקה לא פעילה',false) returning id",[org])).rows[0].id;
 await actAs(pg,other);const foreignOrg=(await pg.query("select create_organization('Other inbox QA','agency') id")).rows[0].id;await pg.exec('reset role');
 const foreign=(await pg.query("insert into organization_rejection_reasons(organization_id,label) values($1,'Other reason') returning id",[foreignOrg])).rows[0].id;
 await actAs(pg,clientUser);let portal=(await pg.query('select client_portal_data() d')).rows[0].d;
 assert.equal(portal.schema_version,2);assert.equal(portal.presentations.length,1);assert.deepEqual(portal.clients[0].rejection_reasons.map(r=>r.id),[approved]);
 const revision=portal.presentations[0].share_revision;
 assert.ok(!JSON.stringify(portal).includes('INTERNAL MUST STAY PRIVATE'));assert.ok(!JSON.stringify(portal).includes('private-inbox@example.invalid'));
 await assert.rejects(pg.query('select client_portal_data_before_inbox()'),/permission denied/);
 await assert.rejects(pg.query('select client_presentation_document_before_inbox($1)',[share]),/permission denied/);
 await assert.rejects(pg.query('select * from organization_rejection_reasons'),/permission denied/);
 for(const reason of [null,inactive,foreign])await assert.rejects(pg.query("select submit_client_portal_response($1,$2,'reject','Reason required',$3)",[share,revision,reason]),/REJECTION_REASON_REQUIRED/);
 await assert.rejects(pg.query("select submit_client_feedback($1,'reject','Bypass')",[share]),/REJECTION_REASON_REQUIRED/);
 assert.equal((await pg.query('select client_portal_data() d')).rows[0].d.presentations.length,1);
 assert.equal((await pg.query('select client_presentation_document($1) d',[share])).rows[0].d.label,'Synthetic.pdf');
 await pg.query("select submit_client_portal_response($1,$2,'reject','Synthetic feedback',$3)",[share,revision,approved]);
 portal=(await pg.query('select client_portal_data() d')).rows[0].d;assert.equal(portal.presentations.length,0);assert.equal(portal.clients.length,1);
 assert.equal((await pg.query('select can_view_client_presentation($1) ok',[share])).rows[0].ok,false);
 await assert.rejects(pg.query('select client_presentation_document($1)',[share]),/Not permitted/);
 assert.equal((await pg.query('select can_read_org_document($1) ok',[path])).rows[0].ok,false);
 assert.equal((await pg.query("select count(*) n from storage.objects where bucket_id='organization-cvs'")).rows[0].n,0);
 await assert.rejects(pg.query("select submit_client_feedback($1,'proceed','Duplicate')",[share]),/Not permitted/);
 await actAs(pg,manager);let detail=(await pg.query('select placement_pilot_details($1) d',[placement])).rows[0].d;
 const feedback=detail.presentations[0].feedback[0];assert.ok(feedback.note.startsWith('סיבת בדיקה מאושרת'));assert.ok(feedback.note.includes('Synthetic feedback'));await pg.exec('reset role');const typed=(await pg.query('select rejection_reason_id,rejection_reason_label from client_feedback where presentation_id=$1',[share])).rows[0];assert.equal(typed.rejection_reason_id,approved);assert.equal(typed.rejection_reason_label,'סיבת בדיקה מאושרת');await actAs(pg,manager);
 assert.equal((await pg.query('select can_read_org_document($1) ok',[path])).rows[0].ok,true);
 assert.equal((await pg.query("select count(*) n from notifications where kind='client_feedback'")).rows[0].n,1);
 assert.equal((await pg.query("select share_candidate_portal($1,'New explicit request',$2) id",[submission,doc])).rows[0].id,share);
 await actAs(pg,clientUser);portal=(await pg.query('select client_portal_data() d')).rows[0].d;assert.equal(portal.presentations.length,1);assert.ok(portal.presentations[0].share_revision>revision);
 // Previous comments/reasons must not become a client-visible archive on a re-share.
 assert.equal(portal.presentations[0].feedback.length,0);
 await assert.rejects(pg.query("select submit_client_portal_response($1,$2,'proceed','')",[share,revision]),/REFERRAL_UPDATED/);
 await pg.query("select submit_client_portal_response($1,$2,'proceed','Next step')",[share,portal.presentations[0].share_revision]);
 assert.equal((await pg.query('select client_portal_data() d')).rows[0].d.presentations.length,0);
 await actAs(pg,manager);detail=(await pg.query('select placement_pilot_details($1) d',[placement])).rows[0].d;assert.equal(detail.presentations[0].feedback.length,2);
 await actAs(pg,other);assert.equal((await pg.query('select client_portal_data() d')).rows[0].d.presentations.length,0);await assert.rejects(pg.query('select client_presentation_document($1)',[share]),/Not permitted/);
 }finally{await pg.close()}
});

test('Migration preserves historical feedback and keeps re-shared unanswered candidates in the queue',async()=>{
 const pg=await testDatabase({beforeMigration:'067_client_response_inbox.sql'});try{
 const manager='d3000000-0000-4000-8000-000000000001',user='d3000000-0000-4000-8000-000000000002';
 await pg.query("insert into auth.users(id,email,email_confirmed_at) values($1,'migration-admin@example.invalid',now()),($2,'migration-client@example.invalid',now())",[manager,user]);
 await actAs(pg,manager);const org=(await pg.query("select create_organization('Migration QA','agency') id")).rows[0].id;
 const client=(await pg.query("insert into agency_clients(organization_id,name) values($1,'Migration client') returning id",[org])).rows[0].id;await pg.query("select set_client_portal_member($1,'migration-client@example.invalid')",[client]);
 const job=(await pg.query("insert into jobs(organization_id,title,location,type,description,client_id,is_public) values($1,'QA','Test','full-time','QA',$2,false) returning id",[org,client])).rows[0].id;
 const shares=[];
 for(let i=0;i<2;i++){
  const candidate=(await pg.query("insert into candidates(organization_id,owner_id,full_name,email,visibility) values($1,$2,'Synthetic migration candidate',$3,'shared') returning id",[org,manager,'migration-'+i+'@example.invalid'])).rows[0].id;
  const placement=(await pg.query('insert into candidate_placements(organization_id,candidate_id,job_id,created_by) values($1,$2,$3,$4) returning id',[org,candidate,job,manager])).rows[0].id;await pg.query('select request_candidate_submission($1)',[placement]);
  const submission=(await pg.query('select id from candidate_submissions where placement_id=$1',[placement])).rows[0].id;
  const id=(await pg.query("select share_candidate_portal($1,'Synthetic migration summary',null) id",[submission])).rows[0].id;
  await actAs(pg,user);await pg.query("select submit_client_feedback($1,'note','Historical reply')",[id]);await actAs(pg,manager);shares.push({id,submission});
 }
 await pg.query("select share_candidate_portal($1,'Explicit new request',null)",[shares[0].submission]);
 await pg.exec('reset role');await pg.query("update client_feedback set created_at=(select shared_at-interval '1 day' from client_presentations where id=$1) where presentation_id=$1",[shares[0].id]);
 await pg.exec(await readFile(new URL('../supabase/migrations/067_client_response_inbox.sql',import.meta.url),'utf8'));
 assert.equal((await pg.query('select count(*) n from client_feedback')).rows[0].n,2);
 assert.equal((await pg.query('select share_revision from client_feedback where presentation_id=$1',[shares[0].id])).rows[0].share_revision,0);
 await actAs(pg,user);const portal=(await pg.query('select client_portal_data() d')).rows[0].d;
 assert.deepEqual(portal.presentations.map(x=>x.id),[shares[0].id]);assert.equal(portal.presentations[0].feedback.length,0);
 await assert.rejects(pg.query('select client_presentation_document($1)',[shares[1].id]),/Not permitted/);
 }finally{await pg.close()}
});
