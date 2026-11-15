import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deliverCv, validCvRequest } from '../lib/cv-delivery.mjs';
const id = 'e0000000-0000-4000-8000-000000000001';
function request(input, authorization = 'Bearer test-user-token') {
  return new Request('https://example.invalid/api/cv', {
    method: 'POST', headers: authorization ? { Authorization: authorization } : {}, body: JSON.stringify(input),
  });
}
test('CV server refuses unauthenticated, malformed and traversal requests before reading storage', async () => {
  let touched = false;
  const deps = { authorize: () => { touched = true; }, download: () => { touched = true; } };
  assert.equal((await deliverCv(request({ kind: 'organization', document: id }, ''), deps)).status, 401);
  for (const body of [{ kind: 'organization', document: '../file' }, { kind: 'candidate', path: `${id}/../secret.pdf` }, { kind: 'candidate', path: 'https://attacker.invalid/a.pdf' }]) {
    assert.equal((await deliverCv(request(body), deps)).status, 400);
  }
  assert.equal(touched, false);
  assert.equal(validCvRequest({ kind: 'candidate', path: `${id}/fixture.pdf` }), true);
});
test('same CV request is denied after revocation; previous success is never cached or used as authorization', async () => {
  let allowed = true, authChecks = 0, reads = 0;
  const deps = {
    authorize: async () => { authChecks++; return allowed ? { bucket: 'organization-cvs', path: 'private.pdf' } : null; },
    download: async () => { reads++; return new Blob(['%PDF-1.4 synthetic'], { type: 'application/pdf' }); },
  };
  const body = { kind: 'presentation', presentation: id };
  const first = await deliverCv(request(body), deps);
  assert.equal(first.status, 200);
  assert.equal(await first.text(), '%PDF-1.4 synthetic');
  for (const header of ['cache-control', 'cdn-cache-control', 'vercel-cdn-cache-control']) assert.match(first.headers.get(header), /no-store/);
  allowed = false;
  const revoked = await deliverCv(request(body), deps);
  assert.equal(revoked.status, 403);
  assert.equal(authChecks, 2);
  assert.equal(reads, 1);
  assert.match(revoked.headers.get('cache-control'), /no-store/);
  assert.equal((await revoked.text()).includes('private.pdf'), false);
});
test('CV authorization errors fail closed and never invoke privileged storage', async () => {
  let read = false;
  const response = await deliverCv(request({ kind: 'organization', document: id }), {
    authorize: async () => { throw new Error('private diagnostics'); },
    download: async () => { read = true; },
  });
  assert.equal(response.status, 403); assert.equal(read, false);
  assert.equal((await response.text()).includes('diagnostics'), false);
});
