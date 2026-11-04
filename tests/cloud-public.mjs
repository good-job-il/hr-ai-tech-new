import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const vars=Object.fromEntries((await readFile(new URL('../.env.local',import.meta.url),'utf8')).trim().split(/\r?\n/).filter(Boolean).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)]}));
assert.equal(vars.NEXT_PUBLIC_SUPABASE_URL,'https://ruejyiromtthygqtpcsy.supabase.co','This test is restricted to the isolated staging project');
const db=createClient(vars.NEXT_PUBLIC_SUPABASE_URL,vars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
for(const table of ['jobs','organizations']){const r=await db.from(table).select('*',{head:true,count:'exact'});assert.equal(r.error,null,table);assert.equal(typeof r.count,'number');console.log(JSON.stringify({test:'anonymous public count',table,status:r.status,actualCount:r.count}));}
for(const table of ['candidates','applications','memberships','candidate_profiles','reward_policies','interviews','access_requests']){const r=await db.from(table).select('*');assert.ok(r.error,'Anonymous access unexpectedly allowed: '+table);console.log(JSON.stringify({test:'anonymous private access denied',table,status:r.status}));}
const login=await db.auth.signInWithPassword({email:'nonexistent-cloud-test@example.invalid',password:'NotAnExistingAccount-2026!'});assert.ok(login.error);assert.equal(login.data.session,null);console.log(JSON.stringify({test:'invalid login denied',status:login.error.status,code:login.error.code}));
console.log('PASS: live public API counts, private data denial and invalid-login rejection; no users or records created.');
