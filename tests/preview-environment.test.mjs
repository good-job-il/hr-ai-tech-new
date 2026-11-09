import {test} from 'node:test';import assert from 'node:assert/strict';
import {previewEnvironmentErrors,assertPreviewEnvironment} from '../lib/preview-environment.mjs';
const valid={PREVIEW_SUPABASE_PROJECT_REF:'abcdefghijklmnopqrst',NEXT_PUBLIC_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'test-public-key',NEXT_PUBLIC_SITE_URL:'https://qa.example.invalid'};
test('Preview rejects working databases, missing/mismatched project, official origin and inherited privileged credentials',()=>{
 assert.deepEqual(previewEnvironmentErrors(valid),[]);
 assert.doesNotThrow(()=>assertPreviewEnvironment(valid));
 for(const patch of [{PREVIEW_SUPABASE_PROJECT_REF:'rnstsczayhzrxzcstzpr',NEXT_PUBLIC_SUPABASE_URL:'https://rnstsczayhzrxzcstzpr.supabase.co'},{PREVIEW_SUPABASE_PROJECT_REF:''},{NEXT_PUBLIC_SUPABASE_URL:'https://another.supabase.co'},{NEXT_PUBLIC_SITE_URL:'https://www.hr-ai.tech'},{NEXT_PUBLIC_SITE_URL:'https://qa.example.invalid/path'},{NEXT_SUPABASE_DB_PASS:'private-sentinel'},{SUPABASE_SECRET_KEY:'private-sentinel'},{NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:''}]){
  assert.throws(()=>assertPreviewEnvironment({...valid,...patch}),error=>!error.message.includes('private-sentinel'));
 }
});
