import {test} from 'node:test';
import assert from 'node:assert/strict';
import {siteOrigin, validatePreviewEnvironment} from '../lib/site-environment.mjs';

const preview = {PREVIEW_SUPABASE_PROJECT_REF:'abcdefghijklmnopqrst', NEXT_PUBLIC_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'synthetic-publishable-key', VERCEL_URL:'hr-ai-preview.example.invalid'};
test('Preview rejects working databases, inherited privileges, mismatched projects and official origins', () => {
  assert.deepEqual(validatePreviewEnvironment(preview), []);
  for (const changes of [
    {PREVIEW_SUPABASE_PROJECT_REF:'rnstsczayhzrxzcstzpr', NEXT_PUBLIC_SUPABASE_URL:'https://rnstsczayhzrxzcstzpr.supabase.co'},
    {NEXT_PUBLIC_SUPABASE_URL:'https://ruejyiromtthygqtpcsy.supabase.co'},
    {PREVIEW_SUPABASE_PROJECT_REF:''}, {NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:''},
    {SUPABASE_SERVICE_ROLE_KEY:'synthetic-secret'}, {NEXT_SUPABASE_DB_PASS:'synthetic-password'},
    {NEXT_PUBLIC_SITE_URL:'https://www.hr-ai.tech'}, {NEXT_PUBLIC_SITE_URL:'https://hr-ai.tech'},
    {NEXT_PUBLIC_SITE_URL:'https://headhunter-preview.vercel.app'}, {VERCEL_URL:''},
  ]) assert.ok(validatePreviewEnvironment({...preview, ...changes}).length);
  assert.ok(validatePreviewEnvironment({}).length);
});
test('Metadata origins use the deployment URL and reject unsafe or ambiguous URL components', () => {
  assert.equal(siteOrigin({deploymentUrl:preview.VERCEL_URL}), 'https://hr-ai-preview.example.invalid');
  assert.equal(siteOrigin({siteUrl:'https://preview.example.invalid/', deploymentUrl:preview.VERCEL_URL}), 'https://preview.example.invalid');
  assert.equal(siteOrigin({development:true}), 'http://localhost:3000');
  for (const siteUrl of ['http://example.invalid','https://user:secret@example.invalid','https://example.invalid/path','https://example.invalid/?secret=value','https://example.invalid/#x','invalid']) assert.throws(() => siteOrigin({siteUrl}));
});
