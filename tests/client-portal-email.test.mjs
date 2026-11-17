import test from 'node:test';import assert from 'node:assert/strict';
import {clientPortalRedirect,requestClientPortalEmail} from '../lib/client-portal-email.mjs';
test('Client email sign-in uses existing accounts and a same-origin referral redirect without passwords',async()=>{
 let request;const auth={signInWithOtp:async value=>{request=value;return {error:null}}};
 const id='a2000000-0000-4000-8000-000000000001';
 await requestClientPortalEmail(auth,' owner@example.invalid ','https://www.hr-ai.tech',id);
 assert.deepEqual(request,{email:'owner@example.invalid',options:{shouldCreateUser:false,emailRedirectTo:'https://www.hr-ai.tech/client-portal?referral='+id}});
 assert.equal(clientPortalRedirect('http://localhost:3104','https://attacker.invalid'),'http://localhost:3104/client-portal');
 for(const origin of ['https://www.hr-ai.tech/evil','http://hr-ai.tech','javascript:alert(1)','https://user:password@www.hr-ai.tech'])assert.throws(()=>clientPortalRedirect(origin),/INVALID_AUTH_ORIGIN/);
 await assert.rejects(requestClientPortalEmail(auth,'not-an-email','https://www.hr-ai.tech'),/INVALID_EMAIL/);
});
test('Email errors never expose account existence or provider internals',async()=>{
 for(const code of ['user_not_found','signup_disabled'])await requestClientPortalEmail({signInWithOtp:async()=>({error:{code,message:'private detail'}})},'owner@example.invalid','https://www.hr-ai.tech');
 await assert.rejects(requestClientPortalEmail({signInWithOtp:async()=>({error:{code:'over_email_send_rate_limit'}})},'owner@example.invalid','https://www.hr-ai.tech'),/EMAIL_RATE_LIMIT/);
 await assert.rejects(requestClientPortalEmail({signInWithOtp:async()=>({error:{code:'unexpected_failure',message:'private detail'}})},'owner@example.invalid','https://www.hr-ai.tech'),/^Error: EMAIL_UNAVAILABLE$/);
});
