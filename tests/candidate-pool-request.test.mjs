import {test} from 'node:test';import assert from 'node:assert/strict';
import {requestCandidatePool} from '../lib/candidate-pool-request.mjs';
test('Pool retries a transient failure once, never retries permission failures and cancels obsolete work without caching',async()=>{
 const ok={status:200,data:{count:25},error:null},bad={status:503,error:{code:'temporary'}},denied={status:403,error:{code:'42501'}};
 const run=async(results,abortDuringWait=false)=>{let calls=0,waits=0;const ac=new AbortController();const client={rpc(name,params){assert.equal(name,'search_candidate_pool');assert.equal(params.org,'synthetic');return{abortSignal:async signal=>{assert.equal(signal,ac.signal);return results[Math.min(calls++,results.length-1)];}};}};const result=await requestCandidatePool(client,{org:'synthetic'},ac.signal,async()=>{waits++;if(abortDuringWait)ac.abort();});return{calls,waits,result};};
 assert.deepEqual(await run([bad,ok]),{calls:2,waits:1,result:ok});
 assert.deepEqual(await run([denied]),{calls:1,waits:0,result:denied});
 assert.deepEqual(await run([bad]),{calls:2,waits:1,result:bad});
 assert.deepEqual(await run([bad,ok],true),{calls:1,waits:1,result:bad});
 assert.equal((await run([ok])).calls,1);
});
