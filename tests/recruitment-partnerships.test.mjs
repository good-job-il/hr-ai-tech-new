import {test} from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase,actAs} from './support/database.mjs';
test('Partnership records isolate organizations, restrict coordinators and audit changes',async()=>{
 const pg=await testDatabase();try{
 const a='e9000000-0000-4000-8000-000000000001',b='e9000000-0000-4000-8000-000000000002',c='e9000000-0000-4000-8000-000000000003';
 for(const id of [a,b,c])await pg.query('insert into auth.users(id) values($1)',[id]);
 await actAs(pg,a);const org=(await pg.query("select create_organization('Agency fixture','agency') id")).rows[0].id;
 await pg.query("select set_member_role($1,$2,'recruitment_coordinator')",[org,c]);
 const id=(await pg.query("insert into recruitment_partnerships(organization_id,name,partner_type) values($1,'Client fixture','employer') returning id",[org])).rows[0].id;
 await assert.rejects(pg.query("update recruitment_partnerships set ends_on='2026-01-01',starts_on='2026-02-01' where id=$1",[id]),/check constraint/);
 await pg.query("update recruitment_partnerships set status='active' where id=$1",[id]);
 assert.equal((await pg.query("select count(*)::int n from management_audit where entity_id=$1",[id])).rows[0].n,2);
 await actAs(pg,b);assert.equal((await pg.query('select * from recruitment_partnerships')).rows.length,0);
 await assert.rejects(pg.query("insert into recruitment_partnerships(organization_id,name,partner_type) values($1,'Intruder','employer')",[org]),/row-level security/);
 await actAs(pg,c);assert.equal((await pg.query('select * from recruitment_partnerships')).rows.length,0);
 await assert.rejects(pg.query("insert into recruitment_partnerships(organization_id,name,partner_type) values($1,'Coordinator','employer')",[org]),/row-level security/);
 }finally{await pg.close()}
});
