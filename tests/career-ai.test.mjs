import test from 'node:test';
import assert from 'node:assert/strict';
import {careerConfigured,validateCareerInput,runOpenAICareer,createCareerHandler} from '../lib/career-openai.mjs';
const env={OPENAI_API_KEY:'synthetic-key',CAREER_AI_CREDITS_ONLY:'true',CAREER_AI_CREDITS_VALID_UNTIL:'2099-01-01T00:00:00Z'};
const input={task:'cv-improvement',language:'en',profileText:'Synthetic QA professional with five years of software testing experience.',consent:true};
const result={summary:'Useful guidance',suggestions:['Clarify your professional experience'],limitations:['AI guidance requires review']};
const completed=r=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(r)}]}]});
const request=(body=input,headers={})=>new Request('https://example.test/api/career',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer synthetic',...headers},body:JSON.stringify(body)});
test('credit-only configuration fails closed without key, confirmation or valid expiry',()=>{
 assert.equal(careerConfigured(env),true);
 for(const partial of [{...env,OPENAI_API_KEY:''},{...env,CAREER_AI_CREDITS_ONLY:''},{...env,CAREER_AI_CREDITS_VALID_UNTIL:'invalid'},{...env,CAREER_AI_CREDITS_VALID_UNTIL:'2000-01-01'}])assert.equal(careerConfigured(partial),false);
});
test('all four tasks validate; role comparison and interviews require job details',()=>{
 for(const task of ['cv-improvement','job-matching','interview-preparation','career-insights'])assert.equal(validateCareerInput({...input,task,jobText:'Synthetic software testing role requiring API test automation.'}).task,task);
 for(const bad of [{...input,consent:false},{...input,task:'hire'},{...input,language:'unknown'},{...input,profileText:'tiny'},{...input,profileText:'x'.repeat(16001)},{...input,jobText:3},{...input,task:'job-matching'}])assert.throws(()=>validateCareerInput(bad));
});
test('real API contract: fixed endpoint/model, no store, bounded output, no tools, strict schema; Hebrew display removes niqqud',async()=>{
 let calls=0;
 const actual=await runOpenAICareer({...input,language:'he'},{env,fetcher:async(url,options)=>{
  calls++;assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.headers.Authorization,'Bearer synthetic-key');
  const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.model,'gpt-6.1-sol');assert.equal(body.max_output_tokens,3000);assert.equal(body.tools,undefined);assert.equal(body.text.format.strict,true);assert.match(body.instructions,/untrusted data/);assert.match(body.instructions,/Hebrew without niqqud/);
  return completed({...result,summary:'שָׁלוֹם'});
 }});assert.equal(actual.summary,'שלום');assert.equal(calls,1);
});
test('quota, provider auth, refusal, malformed or incomplete responses never become success or retry',async()=>{
 for(const [response,code] of [[new Response('',{status:429}),'AI_QUOTA_REACHED'],[new Response('',{status:401}),'AI_NOT_CONFIGURED'],[Response.json({status:'incomplete'}),'AI_INCOMPLETE'],[Response.json({status:'completed',output:[{type:'message',content:[{type:'refusal'}]}]}),'AI_REFUSED'],[completed({summary:'bad',suggestions:3}),'AI_INVALID_RESPONSE']]){
  let calls=0;await assert.rejects(runOpenAICareer(input,{env,fetcher:async()=>{calls++;return response}}),{code});assert.equal(calls,1);
 }
 await assert.rejects(runOpenAICareer(input,{env,fetcher:async()=>{throw new Error('private provider detail')}}),{code:'AI_TIMEOUT'});
});
test('authentication and explicit consent enforced before any AI call; errors never disclose secrets',async()=>{
 let calls=0;const dependencies={configured:()=>true,verifyUser:async()=>true,run:async()=>{calls++;return result}};
 assert.equal((await createCareerHandler({...dependencies,verifyUser:async()=>false})(request())).status,401);
 assert.equal((await createCareerHandler(dependencies)(request(input,{Authorization:''}))).status,401);
 assert.equal((await createCareerHandler(dependencies)(request({...input,consent:false}))).status,400);
 assert.equal((await createCareerHandler({...dependencies,configured:()=>false})(request())).status,503);
 assert.equal(calls,0);
 const success=await createCareerHandler(dependencies)(request());assert.equal(success.headers.get('cache-control'),'no-store');assert.deepEqual((await success.json()).result,result);assert.equal(calls,1);
 const failure=await createCareerHandler({...dependencies,run:async()=>{throw new Error('synthetic-private-key')}})(request());assert.equal(failure.status,503);assert.doesNotMatch(await failure.text(),/private-key/);
});
test('oversized stream without content-length rejected before provider; invalid JSON rejected',async()=>{
 let calls=0;const handler=createCareerHandler({configured:()=>true,verifyUser:async()=>true,run:async()=>{calls++;return result}});
 const large=request({...input,profileText:'א'.repeat(60000)});assert.equal(large.headers.get('content-length'),null);assert.equal((await handler(large)).status,413);assert.equal(calls,0);
 const invalid=new Request('https://example.test/api/career',{method:'POST',headers:{Authorization:'Bearer synthetic','Content-Type':'application/json'},body:'{'});assert.equal((await handler(invalid)).status,400);
});
