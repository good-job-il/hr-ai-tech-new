import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {catalogPageUrl,catalogPreloadScript} from '../lib/catalog-preload.mjs';
const require=createRequire(new URL('../proxy.ts',import.meta.url));

test('Public preload starts an anonymous request, keeps ordering/pagination, and fails into normal retry',async()=>{
 const calls=[],window={};
 const script=catalogPreloadScript('https://project.supabase.co','public-test-key');
 vm.runInNewContext(script,{window,Date,fetch:async(...args)=>{calls.push(args);return {ok:true,json:async()=>[{id:'public-row'}],headers:new Headers({'content-range':'0-0/501'})}}});
 const page=await window.__hrPublicCatalog.promise;
 assert.equal(page.count,501);assert.equal(page.data.length,1);
 const [url,options]=calls[0];
 assert.equal(new URL(url).pathname,'/rest/v1/public_job_catalog');
 assert.equal(new URL(url).searchParams.get('order'),'verified_at.desc.nullslast,id.asc');
 assert.equal(new URL(catalogPageUrl('https://project.supabase.co',500)).searchParams.get('offset'),'500');
 assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');
 assert.equal(options.headers.Authorization,undefined);assert.equal(options.headers.apikey,'public-test-key');
 for(const fail of [async()=>{throw Error('Network')},async()=>({ok:false})]){
  const window={};vm.runInNewContext(script,{window,Date,fetch:fail});
  assert.equal(await window.__hrPublicCatalog.promise,null);
 }
 assert.equal(catalogPreloadScript(undefined,undefined),'');
 assert.ok(!catalogPreloadScript('https://project.supabase.co','</script><script>bad').includes('</script>'));
});

test('Public language rewrites preserve private-query noindex and leave shared-job metadata dynamic',async()=>{
 const ts=require('typescript'),{NextRequest}=require('next/server');
 const {unstable_doesMiddlewareMatch:doesProxyMatch,getRewrittenUrl}=require('next/experimental/testing/server');
 const source=await readFile(new URL('../proxy.ts',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const module={exports:{}};
 vm.runInNewContext(compiled,{URL,exports:module.exports,require,process:{env:{VERCEL_ENV:'production'}}});
 const {proxy,config}=module.exports;
 for(const [cookie,language] of [['','en'],['hh-language=he','he'],['hh-language=invalid','en']]){
  const response=proxy(new NextRequest('https://www.hr-ai.tech/',{headers:{cookie}}));
  assert.equal(getRewrittenUrl(response),'https://www.hr-ai.tech/'+language);
  assert.equal(response.headers.get('X-Robots-Tag'),'index, follow');
 }
 for(const query of ['view=admin','invite=example','code=example','measure=performance']){
  const response=proxy(new NextRequest('https://www.hr-ai.tech/?'+query));
  assert.equal(new URL(getRewrittenUrl(response)).search,'?'+query);
  assert.equal(response.headers.get('X-Robots-Tag'),'noindex, nofollow');
 }
 assert.equal(proxy(new NextRequest('https://www.hr-ai.tech/?job=existing&source=external')).headers.get('x-middleware-rewrite'),null);
 assert.equal(proxy(new NextRequest('https://www.hr-ai.tech/he')).headers.get('X-Robots-Tag'),'noindex, nofollow');
 for(const url of ['/api/whatsapp/webhook','/client-portal','/_next/static/chunk.js','/review'])assert.equal(doesProxyMatch({config,nextConfig:{},url}),false);
});
