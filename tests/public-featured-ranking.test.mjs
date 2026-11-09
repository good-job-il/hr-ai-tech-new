import {test} from 'node:test';import assert from 'node:assert/strict';
import {testDatabase,actAs} from './support/database.mjs';
import {applyFeaturedRanking,featuredJobs} from '../lib/featured-ranking.mjs';

test('Featured ranking preserves catalog order and separates internal/external IDs',()=>{
 const jobs=Array.from({length:10},(_,i)=>({id:String(i),external:i===0}));
 const ids=[{id:'9',external:false},{id:'0',external:true}];
 const ranked=applyFeaturedRanking(jobs,ids);
 assert.deepEqual(ranked.map(x=>x.id),jobs.map(x=>x.id));
 assert.deepEqual(featuredJobs(ranked).map(x=>x.id),['9','0']);
 assert.equal(jobs[0].featuredRank,undefined);
 assert.equal(applyFeaturedRanking(jobs,[{id:'0',external:false},{id:'0',external:false}]),jobs);
 assert.equal(featuredJobs(applyFeaturedRanking(jobs,null)).length,8);
});

test('Anonymous featured RPC ranks real submissions, caps eight and excludes private/test/closed jobs',async()=>{
 const pg=await testDatabase();try{
  const owner='c2000000-0000-4000-8000-000000000001',candidate='c2000000-0000-4000-8000-000000000002';
  await pg.query('insert into auth.users(id) values($1),($2)',[owner,candidate]);await actAs(pg,owner);
  const org=(await pg.query("select create_organization('Featured QA','employer') id")).rows[0].id;
  const jobs=[];for(let i=0;i<10;i++)jobs.push((await pg.query("insert into jobs(organization_id,title,location,type,description) values($1,$2,'QA','full-time','Synthetic') returning id",[org,'Role '+i])).rows[0].id);
  await pg.query("insert into jobs(organization_id,title,location,type,description,is_public) values($1,'PRIVATE','QA','full-time','Synthetic',false)",[org]);
  await pg.query("insert into jobs(organization_id,title,location,type,description,status) values($1,'CLOSED','QA','full-time','Synthetic','closed')",[org]);
  await pg.exec('reset role');
  await pg.query("insert into job_sources(id,company,career_url) values('featured-qa','QA source','https://example.invalid')");
  const external=(await pg.query("insert into external_jobs(source_id,source_url,title,location,description,verified_at,verification_method,publication_status) values('featured-qa','https://example.invalid/zero','External zero','QA','Synthetic',now()-interval '30 days','public-html','published'),('featured-qa','https://example.invalid/one','External one','QA','Synthetic',now()-interval '30 days','public-html','published') returning id")).rows.map(x=>x.id);
  await actAs(pg,candidate);for(const job of jobs.slice(0,4))await pg.query("insert into applications(job_id,candidate_id,cover_letter) values($1,$2,'Synthetic')",[job,candidate]);
  await pg.query("insert into applications(external_job_id,candidate_id,cover_letter) values($1,$2,'Synthetic')",[external[1],candidate]);
  await pg.exec('reset role;set role anon');let ids=(await pg.query('select * from public_featured_job_ids()')).rows;
  assert.equal(ids.length,8);assert(!ids.slice(0,7).some(x=>jobs.slice(0,4).includes(x.id)));assert(ids.some(x=>x.id===external[0]));assert(!ids.some(x=>x.id===external[1]));assert(ids.every(x=>jobs.includes(x.id)||external.includes(x.id)));assert.deepEqual(Object.keys(ids[0]).sort(),['external','id']);
  await pg.exec('reset role');await pg.query('update organizations set is_test=true where id=$1',[org]);await pg.exec('set role anon');ids=(await pg.query('select * from public_featured_job_ids()')).rows;assert.deepEqual(ids.map(x=>x.id),external);
  await pg.exec('reset role');await pg.query("update external_jobs set status='closed' where source_id='featured-qa'");await pg.exec('set role anon');assert.equal((await pg.query('select * from public_featured_job_ids()')).rows.length,0);
 }finally{await pg.close()}
});
