import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {testDatabase,actAs} from './support/database.mjs';

test('Faster pool preserves exact rows, counts, ordering and RLS for owner, manager, team, explicit access, outsider and suspended member',async()=>{
 const pg=await testDatabase();try{
  const historical=await readFile(new URL('../supabase/migrations/041_candidate_pool_sort.sql',import.meta.url),'utf8');
  await pg.exec(historical.replace('public.search_candidate_pool(', 'public.search_candidate_pool_reference('));
  const extension=await readFile(new URL('../supabase/migrations/054_candidate_company_search.sql',import.meta.url),'utf8');
  await pg.exec(extension.slice(extension.indexOf('do $migration$'),extension.indexOf('end $migration$;')+'end $migration$;'.length).replaceAll('public.search_candidate_pool(', 'public.search_candidate_pool_reference('));
  const hierarchy=await readFile(new URL('../supabase/migrations/016_organization_hierarchy.sql',import.meta.url),'utf8');
  const oldPolicy=hierarchy.split('\n').find(x=>x.startsWith('drop policy candidate_read'));
  const optimized=await readFile(new URL('../supabase/migrations/066_candidate_pool_performance.sql',import.meta.url),'utf8');
  const newPolicy=optimized.slice(optimized.indexOf('drop policy candidate_read'),optimized.indexOf('-- Materialize'));
  const users=Array.from({length:7},(_,n)=>`ce660000-0000-4000-8000-${String(n+1).padStart(12,'0')}`);
  for(const id of users)await pg.query('insert into auth.users(id) values($1)',[id]);
  await actAs(pg,users[0]);const org=(await pg.query("select create_organization('Performance equivalence QA','agency') id")).rows[0].id;
  for(const [n,role] of [[1,'team_lead'],[2,'recruitment_coordinator'],[3,'recruitment_coordinator'],[5,'finance'],[6,'recruitment_manager']])await pg.query('select set_member_role($1,$2,$3)',[org,users[n],role]);
  await pg.query('select configure_member($1,$2,$3,true)',[org,users[2],users[1]]);
  await pg.exec('reset role');
  for(let n=0;n<33;n++)await pg.query("insert into candidates(organization_id,owner_id,full_name,email,city,visibility) values($1,$2,$3,$4,$5,$6)",[org,users[n%4],`Synthetic ${String(n).padStart(2,'0')}`,`synthetic-${n}@example.invalid`,n%2?'QA City':'Other City',n%3?'personal':'shared']);
  const privateId=(await pg.query("select id from candidates where full_name='Synthetic 07'")).rows[0].id;
  await pg.exec('reset role');await pg.query('insert into candidate_access(candidate_id,user_id) values($1,$2),($1,$3)',[privateId,users[5],users[4]]);
  await actAs(pg,users[4]);const foreign=(await pg.query("select create_organization('Other tenant QA','agency') id")).rows[0].id;
  await pg.query("insert into candidates(organization_id,owner_id,full_name,email,visibility) values($1,$2,'Foreign shared','foreign@example.invalid','shared')",[foreign,users[4]]);
  const scenarios=[...[ 'name','phone','email','created_at','updated_at','pool','owner'].flatMap(sort_by=>['asc','desc'].flatMap(sort_direction=>[0,1].map(page=>({filters:{sort_by,sort_direction,ui_lang:'en'},page})))),...[{query:'Synthetic 0'},{city:'QA City'},{pool:'mine'},{pool:'shared'},{pool:'personal'},{incomplete:'true'},{role:'missing'},{domain:'missing'},{company:'missing'},{company:'missing',company_scope:'previous'},{region:'missing'},{skill:'missing'},{experience_max:'1'},{salary_ceiling:'1'},{updated_since:'2099-01-01'}].map(filters=>({filters,page:0}))];
  for(let n=0;n<users.length;n++){
   const capture=async(policy,fn)=>{
    await pg.exec('reset role');await pg.exec(policy);await actAs(pg,users[n]);
    const visible=(await pg.query('select id from candidates order by id')).rows;
    if(n===4){await assert.rejects(pg.query(`select ${fn}($1,'{}',0)`,[org]),/Not permitted/);return {visible};}
    const results=[];for(const {filters,page}of scenarios)results.push((await pg.query(`select ${fn}($1,$2,$3) r`,[org,filters,page])).rows[0].r);
    return {visible,results};
   };
   assert.deepEqual(await capture(newPolicy,'search_candidate_pool'),await capture(oldPolicy,'search_candidate_pool_reference'),`actor${n} exact equivalence`);
  }
  await pg.exec('reset role');await pg.query("update memberships set status='suspended' where organization_id=$1 and user_id=$2",[org,users[2]]);
  for(const policy of [oldPolicy,newPolicy]){await pg.exec('reset role');await pg.exec(policy);await actAs(pg,users[2]);assert.equal((await pg.query('select id from candidates')).rows.length,0);await assert.rejects(pg.query("select search_candidate_pool($1,'{}',0)",[org]),/Not permitted/);}
 }finally{await pg.close();}
});
