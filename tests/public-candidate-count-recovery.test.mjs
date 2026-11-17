import {test} from 'node:test';
import assert from 'node:assert/strict';

let version=0;
async function loader(){
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://metric.example.invalid';
 process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='public-test-key';
 return (await import(`../lib/public-candidate-count.ts?case=${++version}`)).loadCandidatePopulationCount;
}

test('a timed-out initial request recovers without another page focus',async t=>{
 const load=await loader();let calls=0;
 t.mock.method(globalThis,'fetch',async()=>{if(++calls===1)throw new DOMException('timeout','TimeoutError');return Response.json(123)});
 assert.equal(await load(),123);assert.equal(calls,2);
});

test('failed refresh retains the real last successful count and later accepts a changed count',async t=>{
 const load=await loader();const responses=[Response.json(123),new Response('',{status:503}),Response.json('invalid'),Response.json(124)];
 t.mock.method(globalThis,'fetch',async()=>responses.shift());
 assert.equal(await load(),123);assert.equal(await load(),123);assert.equal(await load(),124);assert.equal(responses.length,0);
});

test('initial failures do not invent a count and a later retry can recover',async t=>{
 const load=await loader();let success=false,calls=0;
 t.mock.method(globalThis,'fetch',async()=>{calls++;return success?Response.json(47):new Response('',{status:503})});
 assert.equal(await load(),null);assert.equal(calls,2);success=true;assert.equal(await load(),47);
});

test('zero is a valid real count; unsafe and negative values are not',async t=>{
 const load=await loader();const values=[-1,Number.MAX_SAFE_INTEGER+1,0];
 t.mock.method(globalThis,'fetch',async()=>Response.json(values.shift()));
 assert.equal(await load(),null);assert.equal(await load(),0);
});

test('simultaneous mount/focus callers share one pending aggregate request',async t=>{
 const load=await loader();let resolve,calls=0;
 t.mock.method(globalThis,'fetch',()=>{calls++;return new Promise(r=>{resolve=r})});
 const a=load(),b=load();assert.equal(a,b);assert.equal(calls,1);resolve(Response.json(89));
 assert.deepEqual(await Promise.all([a,b]),[89,89]);
});
