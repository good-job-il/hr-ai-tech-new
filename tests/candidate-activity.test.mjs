import {test} from 'node:test';import assert from 'node:assert/strict';
import {testDatabase,actAs} from './support/database.mjs';
test('Staff timeline preserves source events, filters before pagination and refuses cross-scope or replay conflicts without side effects',async()=>{
 const pg=await testDatabase();try{
 const owner='ab450000-0000-4000-8000-000000000001',outside='ab450000-0000-4000-8000-000000000002',client='ab450000-0000-4000-8000-000000000003',viewer='ab450000-0000-4000-8000-000000000004';
 await pg.query("insert into auth.users(id,email,email_confirmed_at) values($1,'owner@history.invalid',now()),($2,'outside@history.invalid',now()),($3,'client@history.invalid',now()),($4,'viewer@history.invalid',now())",[owner,outside,client,viewer]);
 await actAs(pg,owner);const org=(await pg.query("select create_organization('History agency','agency') id")).rows[0].id;
 const c=(await pg.query("insert into candidates(organization_id,owner_id,full_name,email,visibility) values($1,$2,'Synthetic candidate','candidate@history.invalid','personal') returning id",[org,owner])).rows[0].id;
 const other=(await pg.query("insert into candidates(organization_id,owner_id,full_name,email,visibility) values($1,$2,'Other candidate','other@history.invalid','shared') returning id",[org,owner])).rows[0].id;
 const job=(await pg.query("insert into jobs(organization_id,title,location,type,description,is_public) values($1,'Operations','Test','full-time','Synthetic job',false) returning id",[org])).rows[0].id;
 await pg.query("select add_candidate_internal_note($1,'Internal native note, never send')",[c]);
 await pg.query("insert into candidate_placements(organization_id,candidate_id,job_id,created_by) values($1,$2,$3,$4)",[org,c,job,owner]);
 await pg.exec('reset role');
 const before=(await pg.query('select (select count(*) from candidate_placements) placements,(select count(*) from client_presentations) presentations,(select count(*) from notifications) notifications')).rows[0];
 await actAs(pg,owner);
 const rows=Array.from({length:31},(_,i)=>({key:'event-'+i,kind:i%2?'שיחה טלפונית':'הפניה למשרה',occurred_at:new Date(Date.UTC(2025,1,1,0,i)).toISOString(),source_date_text:'01/02/2025 original '+i,author:'Original recruiter',body:i===0?'Exact long note\n'+('full history '.repeat(100)):'Source note '+i,job_id:i%2?job:null,job_label:i%2?'Operations':'Historical role',source_job_id:i%2?'':'old-19',client_label:'Historical client'}));
 await assert.rejects(pg.query('select import_candidate_source_events($1,$2,$3)',[c,'civi-record',JSON.stringify(rows)]),/permission denied/);
 await pg.exec('reset role');let result=(await pg.query('select import_candidate_source_events($1,$2,$3) d',[c,'civi-record',JSON.stringify(rows)])).rows[0].d;assert.deepEqual(result,{inserted:31,skipped:0});
 assert.deepEqual((await pg.query('select import_candidate_source_events($1,$2,$3) d',[c,'civi-record',JSON.stringify(rows)])).rows[0].d,{inserted:0,skipped:31});
 await assert.rejects(pg.query('select import_candidate_source_events($1,$2,$3)',[other,'civi-record',JSON.stringify(rows)]),/SOURCE_IDENTITY_CONFLICT/);
 await assert.rejects(pg.query('select import_candidate_source_events($1,$2,$3)',[other,'civi-record',JSON.stringify([{...rows[0],key:'different-key'}])]),/SOURCE_IDENTITY_CONFLICT/);
 await assert.rejects(pg.query('select import_candidate_source_events($1,$2,$3)',[c,'civi-record',JSON.stringify([{...rows[0],body:'changed'}])]),/SOURCE_EVENT_CHANGED/);
 await assert.rejects(pg.query('select import_candidate_source_events($1,$2,$3)',[c,'civi-record',JSON.stringify([{...rows[0],key:'no-offset',occurred_at:'2025-02-01 10:00'}])]),/OFFSET_REQUIRED/);
 await actAs(pg,owner);
 let data=(await pg.query('select candidate_activity($1) d',[c])).rows[0].d;assert.equal(data.count,34);assert.equal(data.rows.length,25);assert.ok(data.can_note);assert.equal(data.jobs.length,2);
 const last=(await pg.query("select candidate_activity($1,'','','',1) d",[c])).rows[0].d;assert.equal(last.rows.length,9);assert.equal(new Set([...data.rows,...last.rows].map(r=>r.id)).size,34);
 assert.equal(last.rows.find(r=>r.body.startsWith('Exact long note')).body,rows[0].body);
 assert.equal((await pg.query("select candidate_activity($1,$2,'','',0) d",[c,job])).rows[0].d.count,17); //15 imported + placement/status
 assert.equal((await pg.query("select candidate_activity($1,'','civi:שיחה טלפונית','',0) d",[c])).rows[0].d.count,15);
 assert.equal((await pg.query("select candidate_activity($1,'','','Exact long note',0) d",[c])).rows[0].d.count,1);
 assert.equal((await pg.query("select candidate_activity($1,'','','%_',0) d",[c])).rows[0].d.count,0);
 assert.ok(!JSON.stringify(data).includes('object_path'));assert.ok(!JSON.stringify(data).includes('source_payload'));
 await pg.exec('reset role');
 assert.deepEqual((await pg.query('select (select count(*) from candidate_placements) placements,(select count(*) from client_presentations) presentations,(select count(*) from notifications) notifications')).rows[0],before);
 await actAs(pg,owner);
 await assert.rejects(pg.query('select * from candidate_activity_rows($1)',[c]),/permission denied/);
 await pg.exec('reset role');
 const foreignDoc=(await pg.query("insert into candidate_documents(organization_id,candidate_id,object_path,label,uploaded_by) values($1,$2,'private/other.pdf','Other CV',$3) returning id",[org,other,owner])).rows[0].id;
 await assert.rejects(pg.query('select import_candidate_source_events($1,$2,$3)',[c,'civi-record',JSON.stringify([{...rows[0],key:'wrong-doc',document_id:foreignDoc}])]),/DOCUMENT_SCOPE_MISMATCH/);
 await assert.rejects(pg.query('select import_candidate_source_events($1,$2,$3)',[c,'civi-record',JSON.stringify([{...rows[0],key:'partial-first'},{...rows[0],key:'wrong-last',document_id:foreignDoc}])]),/DOCUMENT_SCOPE_MISMATCH/);
 assert.equal((await pg.query('select count(*)::int n from candidate_source_events')).rows[0].n,31);
 await pg.query("insert into candidate_whatsapp_messages(organization_id,candidate_id,author_id,direction,body,status,destination) values($1,$2,$3,'outbound','ANOTHER USER PRIVATE DRAFT','draft','0500000000'),($1,$2,$4,'outbound','OWNER PRIVATE DRAFT','draft','0500000000')",[org,c,viewer,owner]);
 const portalClient=(await pg.query("insert into agency_clients(organization_id,name) values($1,'Portal client') returning id",[org])).rows[0].id;
 await pg.query('insert into client_portal_members(client_id,user_id) values($1,$2)',[portalClient,client]);
 for(const user of [outside,client,viewer]){await actAs(pg,user);await assert.rejects(pg.query('select candidate_activity($1)',[c]),/NOT_PERMITTED/);assert.equal((await pg.query('select * from candidate_source_events')).rows.length,0)}
 await pg.exec('reset role');await pg.query("insert into memberships(organization_id,user_id,role,status) values($1,$2,'viewer','active')",[org,viewer]);await pg.query('insert into candidate_access(candidate_id,user_id) values($1,$2)',[c,viewer]);
 await actAs(pg,viewer);data=(await pg.query('select candidate_activity($1) d',[c])).rows[0].d;assert.equal(data.can_note,false);assert.equal(data.rows.length,25);assert.ok(!JSON.stringify(data).includes('OWNER PRIVATE DRAFT'));assert.ok(JSON.stringify(data).includes('ANOTHER USER PRIVATE DRAFT'));
 await pg.exec('reset role');await pg.query("update memberships set status='suspended' where organization_id=$1 and user_id=$2",[org,viewer]);await actAs(pg,viewer);await assert.rejects(pg.query('select candidate_activity($1)',[c]),/NOT_PERMITTED/);
 await actAs(pg,outside);const org2=(await pg.query("select create_organization('Other employer','employer') id")).rows[0].id;
 const foreignJob=(await pg.query("insert into jobs(organization_id,title,location,type,description,is_public) values($1,'Other','Test','full-time','Other job',false) returning id",[org2])).rows[0].id;
 await pg.exec('reset role');await assert.rejects(pg.query('select import_candidate_source_events($1,$2,$3)',[c,'civi-record',JSON.stringify([{...rows[0],key:'bad-job',job_id:foreignJob}])]),/JOB_SCOPE_MISMATCH/);
 }finally{await pg.close()}
});
