// Real Auth JWT + deployed API + Storage acceptance. Private synthetic manifest only.
// Usage: node --env-file=.env scripts/verify-cv-access.mjs <manifest> <base-url> <report>
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
const [manifestPath, base, reportPath] = process.argv.slice(2);
assert(manifestPath && base && reportPath, 'Manifest, API base URL and report are required');
const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.equal(new URL(url).hostname, 'rnstsczayhzrxzcstzpr.supabase.co');
assert.equal(m.project_ref, 'rnstsczayhzrxzcstzpr');
assert.match(m.run, /^qa-cv-/);
const target = new URL(base);
assert(
  (target.protocol === 'https:' && ['www.hr-ai.tech', 'hr-ai.tech'].includes(target.hostname)) ||
  (target.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(target.hostname)),
  'Use the production website or a local build for test account requests',
);
const legacyFixtures = [
  { bucket: 'organization-cvs', path: m.legacyPath, signedUrl: m.legacySignedUrl, prefix: m.org, role: 'client' },
  { bucket: 'candidate-cvs', path: m.legacyCandidatePath, signedUrl: m.legacyCandidateSignedUrl, prefix: m.users.outsider.id, role: 'recruiter' },
];
for (const {bucket, path, signedUrl, prefix} of legacyFixtures) {
  assert(path && signedUrl, `Capture both legacy URLs for ${bucket} before the cutover`);
  assert(path.startsWith(`${prefix}/`), `Unexpected fixture path for ${bucket}`);
  assert(path.split('/').every(part => /^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(part)), `Unsafe fixture path for ${bucket}`);
  const signed = new URL(signedUrl);
  assert(signed.origin === new URL(url).origin && signed.pathname === `/storage/v1/object/sign/${bucket}/${path}` && signed.searchParams.has('token'), `Unexpected fixture signed URL for ${bucket}`);
}
const clients = {}, results = [];
let fixtureValidated = false;
async function ok(p) { const r = await p; assert.equal(r.error, null, r.error?.message); return r.data; }
async function api(role, input, expected, name) {
  const token = (await clients[role].auth.getSession()).data.session.access_token;
  const response = await fetch(new URL('/api/cv', target), {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input), cache: 'no-store', redirect: 'error',
  });
  assert.equal(response.status, expected, name);
  assert.match(response.headers.get('cache-control') ?? '', /no-store/, name);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (expected === 200) assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), '%PDF-', name);
  results.push({ name, expected, actual: response.status, result: 'PASS' });
}
try {
  for (const [role, u] of Object.entries(m.users)) {
    assert.match(u.email, /^qa-cv-.*@example\.invalid$/);
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const session = await ok(client.auth.signInWithPassword({ email: u.email, password: u.password }));
    assert.equal(session.user.id, u.id); clients[role] = client;
  }
  const admin = clients.admin, recruiter = clients.recruiter;
  const org = await ok(admin.from('organizations').select('id,is_test,name').eq('id', m.org).single());
  assert.equal(org.is_test, true); assert.equal(org.name, 'QA CV 20261109 ' + m.run);
  const document = await ok(admin.from('candidate_documents').select('id,organization_id,object_path').eq('id', m.document).single());
  assert.equal(document.organization_id, m.org);
  const fixtureClient = await ok(admin.from('agency_clients').select('organization_id').eq('id', m.client).single());
  const placement = await ok(admin.from('candidate_placements').select('organization_id').eq('id', m.placement).single());
  assert.equal(fixtureClient.organization_id, m.org); assert.equal(placement.organization_id, m.org);
  const submission = await ok(admin.from('candidate_submissions').select('placement_id').eq('id', m.submission).single());
  assert.equal(submission.placement_id, m.placement);
  fixtureValidated = true;
  const input = { kind: 'organization', document: m.document };
  await ok(admin.rpc('set_member_permission', { org: m.org, member: m.users.recruiter.id, cap: 'cv.download', enabled: false }));
  await api('admin', input, 200, 'organization admin authorized CV');
  await api('recruiter', input, 403, 'recruiter without download grant');
  await api('outsider', input, 403, 'unrelated user cannot open organization CV');
  await ok(admin.rpc('set_member_permission', { org: m.org, member: m.users.recruiter.id, cap: 'cv.download', enabled: true }));
  await api('recruiter', input, 200, 'explicit download grant');
  await ok(admin.rpc('set_member_permission', { org: m.org, member: m.users.recruiter.id, cap: 'cv.download', enabled: false }));
  await api('recruiter', input, 403, 'same request denied after grant revoked');
  await ok(admin.rpc('set_client_portal_member', { client: m.client, email: m.users.client.email, enabled: true }));
  m.presentation = await ok(admin.rpc('share_candidate_portal', { submission: m.submission, professional_summary: 'Synthetic QA only', document: m.document, anonymous_reviewed: false }));
  const shared = { kind: 'presentation', presentation: m.presentation };
  await api('client', shared, 200, 'client explicitly shared document');
  await ok(admin.rpc('revoke_client_presentation', { presentation: m.presentation }));
  await api('client', shared, 403, 'same shared request denied after revoke');
  m.presentation = await ok(admin.rpc('share_candidate_portal', { submission: m.submission, professional_summary: 'Synthetic QA only', document: m.document, anonymous_reviewed: false }));
  await ok(admin.rpc('set_client_portal_member', { client: m.client, email: m.users.client.email, enabled: false }));
  await api('client', { kind: 'presentation', presentation: m.presentation }, 403, 'representative disabled');
  // New direct access/signing must be denied even to a currently authorized org admin.
  for (const [name, operation] of [
    ['direct raw storage download blocked', () => admin.storage.from('organization-cvs').download(document.object_path)],
    ['signed URL creation blocked', () => admin.storage.from('organization-cvs').createSignedUrl(document.object_path, 120)],
    ['signed URL batch creation blocked', () => admin.storage.from('organization-cvs').createSignedUrls([document.object_path], 120)],
  ]) {
    const r = await operation();
    assert(r.error || r.data?.every?.(item => item.error), name);
    results.push({ name, result: 'PASS' });
  }
  assert(m.ownPath && m.application, 'Candidate-CV/application fixture required for both-bucket acceptance');
  const candidateInput = { kind: 'candidate', path: m.ownPath };
  await api('outsider', candidateInput, 200, 'candidate own CV');
  await api('client', candidateInput, 403, 'client cannot read applicant source CV');
  await api('recruiter', candidateInput, 403, 'application CV without download grant');
  await ok(admin.rpc('set_member_permission', { org: m.org, member: m.users.recruiter.id, cap: 'cv.download', enabled: true }));
  await api('recruiter', candidateInput, 200, 'application CV explicit download grant');
  await ok(admin.rpc('set_member_permission', { org: m.org, member: m.users.recruiter.id, cap: 'cv.download', enabled: false }));
  await api('recruiter', candidateInput, 403, 'application CV revoked grant');
  assert((await clients.outsider.storage.from('candidate-cvs').download(m.ownPath)).error, 'candidate raw download blocked');
  assert((await clients.outsider.storage.from('candidate-cvs').createSignedUrl(m.ownPath, 120)).error, 'candidate signed URL blocked');
  for (const {bucket, path, signedUrl, role} of legacyFixtures) {
    const token = (await clients[role].auth.getSession()).data.session.access_token;
    const headers = { apikey: key, Authorization: `Bearer ${token}` };
    for (const [kind, legacyUrl, requestHeaders] of [
      ['authenticated', `${url}/storage/v1/object/authenticated/${bucket}/${path}`, headers],
      ['signed', signedUrl, {}],
    ]) {
      const name = `${bucket}: previous exact ${kind} URL denied`;
      const response = await fetch(legacyUrl, { headers: requestHeaders, cache: 'no-store', redirect: 'error' });
      const bytes = new Uint8Array(await response.arrayBuffer());
      assert([400, 401, 403, 404, 410].includes(response.status), name);
      assert.notEqual(new TextDecoder().decode(bytes.slice(0, 5)), '%PDF-', name);
      results.push({ name, result: 'PASS', status: response.status });
    }
  }
  fs.writeFileSync(reportPath, JSON.stringify({ result: 'PASS', at: new Date().toISOString(), environment: target.origin, project: m.project_ref, results }, null, 2));
  console.log(JSON.stringify({ result: 'PASS', scenarios: results.length }));
} catch (e) {
  fs.writeFileSync(reportPath, JSON.stringify({ result: 'FAIL', at: new Date().toISOString(), results, failure: String(e.message).slice(0, 180) }, null, 2));
  console.error('CV acceptance FAIL; see sanitized report. Do not publish.'); process.exitCode = 1;
} finally {
  if (fixtureValidated && clients.admin && m.presentation) {
    await clients.admin.rpc('revoke_client_presentation', { presentation: m.presentation });
    await clients.admin.rpc('set_member_permission', { org: m.org, member: m.users.recruiter.id, cap: 'cv.download', enabled: false });
    await clients.admin.rpc('set_client_portal_member', { client: m.client, email: m.users.client.email, enabled: false });
  }
  for (const c of Object.values(clients)) await c.auth.signOut({ scope: 'local' });
}
