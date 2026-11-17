import test from 'node:test';import assert from 'node:assert/strict';import {testDatabase} from './support/database.mjs';
import {civiProfessionalReasons,civiStatusUpdates} from '../lib/client-civi-reasons.mjs';
const act=async(pg,id)=>{await pg.exec('reset role');await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await pg.exec('set role authenticated')};
test('Approved Civi decisions stay separate from follow-up updates, with tenant isolation and retry safety',async()=>{
 const pg=await testDatabase();try{
 const owner='c3000000-0000-4000-8000-000000000001',viewer='c3000000-0000-4000-8000-000000000002',outsider='c3000000-0000-4000-8000-000000000003',request='c3000000-0000-4000-8000-000000000004';
 await pg.query("insert into auth.users(id,email,email_confirmed_at) values($1,'status-owner@example.invalid',now()),($2,'status-client@example.invalid',now()),($3,'status-outsider@example.invalid',now())",[owner,viewer,outsider]);
 await act(pg,owner);const org=(await pg.query("select create_organization('Status QA','agency') id")).rows[0].id;
 const client=(await pg.query("insert into agency_clients(organization_id,name) values($1,'Synthetic employer') returning id",[org])).rows[0].id;await pg.query("select set_client_portal_member($1,'status-client@example.invalid',true)",[client]);
 await pg.query('select configure_client_civi_reasons($1)',[org]);await pg.query('select configure_client_civi_reasons($1)',[org]);
 const job=(await pg.query("insert into jobs(organization_id,title,location,type,description,client_id,is_public) values($1,'QA','Test','full-time','QA',$2,false) returning id",[org,client])).rows[0].id;
 const candidate=(await pg.query("insert into candidates(organization_id,owner_id,full_name,email,visibility) values($1,$2,'Synthetic status candidate','status-candidate@example.invalid','shared') returning id",[org,owner])).rows[0].id;
 const placement=(await pg.query('insert into candidate_placements(organization_id,candidate_id,job_id,created_by) values($1,$2,$3,$4) returning id',[org,candidate,job,owner])).rows[0].id;
 await pg.query('select request_candidate_submission($1)',[placement]);const submission=(await pg.query('select id from candidate_submissions where placement_id=$1',[placement])).rows[0].id;
 const share=(await pg.query("select share_candidate_portal($1,'Approved summary') id",[submission])).rows[0].id;
 await act(pg,viewer);let portal=(await pg.query('select client_portal_data() d')).rows[0].d;assert.equal(portal.schema_version,3);let revision=portal.presentations[0].share_revision;
 assert.deepEqual(portal.clients[0].rejection_reasons.map(r=>r.label),civiProfessionalReasons.map(r=>r[0]));
 for(const excluded of ['גילאים','מגזר',...civiStatusUpdates.map(x=>x[1])])assert.ok(!portal.clients[0].rejection_reasons.some(r=>r.label===excluded));
 await assert.rejects(pg.query('select configure_client_civi_reasons($1)',[org]),/Not permitted/);
 await assert.rejects(pg.query("select submit_client_portal_update($1,$2,$3,'age','')",[share,revision,request]),/INVALID_UPDATE/);
 for(let i=0;i<2;i++)await pg.query("select submit_client_portal_update($1,$2,$3,'unreachable','Synthetic contact update')",[share,revision,request]);
 await assert.rejects(pg.query("select submit_client_portal_update($1,$2,$3,'known','Changed retry')",[share,revision,request]),/INVALID_REQUEST_ID/);
 portal=(await pg.query('select client_portal_data() d')).rows[0].d;assert.equal(portal.presentations.length,1);assert.equal(portal.presentations[0].status_updates.length,1);assert.equal(portal.presentations[0].status_updates[0].label,'אינו זמין בטלפון');assert.equal(portal.presentations[0].feedback.length,0);
 await assert.rejects(pg.query('select * from client_presentation_updates'),/permission denied/);
 await assert.rejects(pg.query('select client_portal_data_before_updates()'),/permission denied/);
 await act(pg,outsider);assert.equal((await pg.query('select client_portal_data() d')).rows[0].d.presentations.length,0);await assert.rejects(pg.query("select submit_client_portal_update($1,$2,$3,'known','')",[share,revision,request]),/Not permitted/);await assert.rejects(pg.query('select placement_pilot_details($1)',[placement]),/Not permitted/);
 await act(pg,owner);let detail=(await pg.query('select placement_pilot_details($1) d',[placement])).rows[0].d;assert.equal(detail.presentations[0].status_updates.length,1);assert.equal(detail.presentations[0].feedback.length,0);
 await act(pg,viewer);await pg.query("select submit_client_portal_response($1,$2,'reject','',$3)",[share,revision,portal.clients[0].rejection_reasons[0].id]);assert.equal((await pg.query('select client_portal_data() d')).rows[0].d.presentations.length,0);await assert.rejects(pg.query("select submit_client_portal_update($1,$2,$3,'known','')",[share,revision,request]),/Not permitted/);
 await act(pg,owner);await pg.query("select share_candidate_portal($1,'New approved summary')",[submission]);detail=(await pg.query('select placement_pilot_details($1) d',[placement])).rows[0].d;assert.equal(detail.presentations[0].status_updates.length,1);assert.equal(detail.presentations[0].feedback.length,1);
 await act(pg,viewer);portal=(await pg.query('select client_portal_data() d')).rows[0].d;assert.equal(portal.presentations.length,1);assert.equal(portal.presentations[0].status_updates.length,0);await assert.rejects(pg.query("select submit_client_portal_update($1,$2,$3,'known','')",[share,revision,request]),/REFERRAL_UPDATED/);
 }finally{await pg.close()}
});
