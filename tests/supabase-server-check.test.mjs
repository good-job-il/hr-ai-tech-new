import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {probeServerStorage, serverConfigurationErrors, syntheticPdf} from '../scripts/supabase-server-check.mjs';

const valid = {
 NEXT_PUBLIC_SUPABASE_URL:'https://rnstsczayhzrxzcstzpr.supabase.co',
 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic',
 NEXT_PUBLIC_SITE_URL:'https://www.hr-ai.tech',
 SUPABASE_SECRET_KEY:'sb_secret_synthetic',
};
test('Production check fails closed on wrong project, Preview, public secrets and wrong repository without disclosing values', () => {
 assert.deepEqual(serverConfigurationErrors(valid), []);
 for (const patch of [
  {SUPABASE_SECRET_KEY:''}, {SUPABASE_SECRET_KEY:'eyJ-legacy-sentinel'},
  {NEXT_PUBLIC_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co'},
  {NEXT_PUBLIC_SUPABASE_URL:valid.NEXT_PUBLIC_SUPABASE_URL+'/?secret=private-sentinel'},
  {NEXT_PUBLIC_SITE_URL:'https://qa.invalid'}, {NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:''},
  {VERCEL_ENV:'preview'}, {VERCEL_ENV:'development'},
  {VERCEL_GIT_REPO_OWNER:'other'}, {VERCEL_GIT_REPO_SLUG:'other'},
  {NEXT_PUBLIC_OTHER:'prefix-sb_secret_synthetic-suffix'},
  {NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY:'private-sentinel'},
 ]) {
  const errors = serverConfigurationErrors({...valid, ...patch});
  assert.ok(errors.length);
  assert.doesNotMatch(errors.join(' '), /private-sentinel|sb_secret_synthetic|eyJ-legacy-sentinel/);
 }
});

function fakeClient({failure, publicBucket = false, cleanupFailure = false} = {}) {
 const calls = [], objects = new Map();
 const secretError = () => {throw new Error('private-sentinel');};
 return {calls, objects, storage:{
  async getBucket(bucket) {calls.push(['bucket', bucket]); return {data:{public:publicBucket}};},
  from(bucket) {return {
   async upload(path, bytes, options) {
    calls.push(['upload', bucket, path, options]);
    assert.match(path, /^hr-21-configuration-qa\/[0-9a-f-]+\.pdf$/);
    assert.equal(options.upsert, false);
    objects.set(bucket+'/'+path, bytes);
    if (failure === 'upload') secretError(); // simulate an ambiguous upload outcome
    return {data:{path}};
   },
   async download(path) {
    calls.push(['download', bucket, path]);
    if (failure === 'download') return {error:{message:'private-sentinel'}};
    return {data:new Blob([failure === 'bytes' ? 'wrong bytes' : objects.get(bucket+'/'+path)])};
   },
   async remove(paths) {
    calls.push(['remove', bucket, paths]);
    if (cleanupFailure) secretError();
    for (const path of paths) objects.delete(bucket+'/'+path);
    return {data:paths.map(name => ({name}))};
   },
  };},
 }};
}
test('synthetic probe verifies both private buckets and removes only newly created objects', async () => {
 const client = fakeClient();
 const report = await probeServerStorage(client);
 assert.deepEqual(report.map(x => [x.bucket, x.passed, x.cleanup]), [['candidate-cvs', true, true], ['organization-cvs', true, true]]);
 assert.equal(client.objects.size, 0);
 const uploads = client.calls.filter(x => x[0] === 'upload');
 assert.notEqual(uploads[0][2], uploads[1][2]);
 assert.equal(client.calls.filter(x => x[0] === 'remove').length, 2);
});
test('public buckets are refused before writing or reading files', async () => {
 const client = fakeClient({publicBucket:true});
 const report = await probeServerStorage(client);
 assert.ok(report.every(x => !x.passed && x.failure === 'bucket'));
 assert.deepEqual(client.calls.map(x => x[0]), ['bucket', 'bucket']);
});
test('failed and uncertain uploads, download failures and byte mismatches still clean up; errors are redacted', async () => {
 for (const failure of ['upload', 'download', 'bytes']) {
  const client = fakeClient({failure});
  const report = await probeServerStorage(client);
  assert.ok(report.every(x => !x.passed && x.cleanup));
  assert.equal(client.objects.size, 0);
  assert.doesNotMatch(JSON.stringify(report), /private-sentinel/);
 }
});
test('cleanup failure cannot pass and reports only the synthetic cleanup path', async () => {
 const report = await probeServerStorage(fakeClient({cleanupFailure:true}));
 assert.ok(report.every(x => !x.passed && !x.cleanup && x.cleanupPath.startsWith('hr-21-configuration-qa/')));
 assert.doesNotMatch(JSON.stringify(report), /private-sentinel/);
});
test('PDF fixture xref offsets and stream length are consistent', () => {
 const pdf = syntheticPdf().toString('ascii');
 const offsets = [...pdf.matchAll(/(\d{10}) 00000 n/g)].map(x => Number(x[1]));
 offsets.forEach((offset, index) => assert.ok(pdf.slice(offset).startsWith(`${index + 1} 0 obj`)));
 const xref = Number(pdf.match(/startxref\n(\d+)/)[1]);
 assert.ok(pdf.slice(xref).startsWith('xref\n'));
 const stream = pdf.match(/\/Length (\d+) >>\nstream\n([\s\S]*?)endstream/);
 assert.equal(Number(stream[1]), Buffer.byteLength(stream[2]));
});
test('CLI returns failure without request details for missing configuration or env file', () => {
 const cli = new URL('../scripts/check-supabase-server.mjs', import.meta.url);
 for (const args of [[], ['--config', '/nonexistent/hr-21-private-sentinel.env'], ['--invalid-private-sentinel']]) {
  const result = spawnSync(process.execPath, [fileURLToPath(cli), ...args], {env:{}, encoding:'utf8'});
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout + result.stderr, /private-sentinel|Error:|at file:/);
 }
});
