import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {withoutNiqqud,unpointedContent,unpointedSupabaseFetch} from '../lib/hebrew-text.mjs';
import {localizeJob} from '../lib/localized-job.mjs';
import {jobShare} from '../lib/job-sharing.mjs';
import {sitePageTitle} from '../lib/site-language.mjs';

const title='סטודנט/ית לאֲחָיוּת בנתניה';
const points=/[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/u;
test('Hebrew points are removed from imported and translated content without damaging other languages or punctuation',()=>{
 assert.equal(withoutNiqqud(title),'סטודנט/ית לאחיות בנתניה');
 assert.equal(withoutNiqqud('שָׁלוֹם֑־עולם ׀ ׃ ״ ׳ café résumé العربية'),'שלום־עולם ׀ ׃ ״ ׳ café résumé العربية');
 const original={title,description:'תֵּאוּר',localized_content:{en:{title:'Nursing student',description:'עֲבוֹדָה'}},requirements:['נִסָּיוֹן'],salary:42,active:true,missing:null};
 const result=unpointedContent(original);
 assert.equal(original.title,title);
 assert.equal(result.title,'סטודנט/ית לאחיות בנתניה');
 assert.equal(result.salary,42);assert.equal(result.active,true);assert.equal(result.missing,null);
 const machine={id:'aֲ',source_url:'https://example.invalid/שָם',object_path:'private/שָם.pdf',email:'שָם@example.invalid',label:'שָם.pdf'};
 const cleaned=unpointedContent(machine);
 for(const key of ['id','source_url','object_path','email'])assert.equal(cleaned[key],machine[key]);
 assert.equal(cleaned.label,'שם.pdf');
 for(const language of ['he','en']) assert.doesNotMatch(JSON.stringify(localizeJob(original,language)),points);
 const share=jobShare({...original,id:'10000000-0000-4000-8000-000000000001'});
 assert.doesNotMatch(share.message,points);
 assert.doesNotMatch(sitePageTitle('he',title),points);
});

test('Shared Supabase boundary cleans nested REST results while preserving request bodies, status and count headers',async()=>{
 const input='https://data.invalid/rest/v1/rpc/example';
 const init={method:'POST',body:JSON.stringify({title})};let received;
 const fetcher=unpointedSupabaseFetch(async(url,options)=>{
  received={url,options};
  return new Response(JSON.stringify([{title,nested:{text:title}}]),{status:206,headers:{'content-type':'application/json','content-range':'0-0/37','content-length':'999'}});
 });
 const result=await fetcher(input,init);
 assert.equal(received.url,input);assert.equal(received.options,init);
 assert.equal(result.status,206);assert.equal(result.headers.get('content-range'),'0-0/37');
 assert.equal(result.headers.get('content-length'),null);
 assert.doesNotMatch(JSON.stringify(await result.json()),points);
 for(const [url,response] of [
  ['https://data.invalid/auth/v1/user',Response.json({name:title})],
  ['https://data.invalid/storage/v1/object/file',new Response(title)],
  ['https://data.invalid/rest/v1/jobs',Response.json({message:title},{status:403})],
  ['https://data.invalid/rest/v1/jobs',new Response(null,{status:204})],
  ['https://data.invalid/rest/v1/jobs',new Response('invalid',{headers:{'content-type':'application/json'}})],
 ])assert.equal(await unpointedSupabaseFetch(async()=>response)(url),response);
});

test('Application source cannot reintroduce literal pointed Hebrew UI copy',async()=>{
 async function scan(directory){for(const entry of await readdir(directory,{withFileTypes:true})){
  const path=directory+'/'+entry.name;
  if(entry.isDirectory())await scan(path);
  else if(/\.(tsx?|m?js|json)$/.test(entry.name))assert.doesNotMatch(await readFile(path,'utf8'),points,path);
 }}
 await scan('app');await scan('lib');
});
