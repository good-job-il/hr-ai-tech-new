// Read-only HR-5 evidence. Never prints credential values or application records.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const target = new URL(process.argv[2] || 'https://www.hr-ai.tech/');
if (target.protocol !== 'https:') throw new Error('Use an HTTPS target');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).flatMap(line => {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  return m ? [[m[1], m[2].replace(/^(['"])(.*)\1$/, '$2')]] : [];
}));
const localRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const refs = text => [...new Set([...text.matchAll(/https:\/\/([a-z]{20})\.supabase\.co/g)].map(m => m[1]))];
const findings = [];
function scan(path, text, scope) {
  const patterns = {
    secretKey: /sb_secret_[A-Za-z0-9_-]+/,
    privateKey: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    credentialUrl: /postgres(?:ql)?:\/\/[^\s:'"]+:[^\s@'"]+@/,
  };
  for (const [kind, pattern] of Object.entries(patterns)) if (pattern.test(text)) findings.push({ scope, path, kind });
  for (const m of text.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
    try { if (JSON.parse(Buffer.from(m[0].split('.')[1], 'base64url')).role === 'service_role') findings.push({ scope, path, kind: 'serviceRoleJwt' }); } catch {}
  }
  // Also compare actual local non-public credentials, without emitting them.
  for (const [name, value] of Object.entries(env)) if (!name.startsWith('NEXT_PUBLIC_') && value.length >= 16 && text.includes(value)) findings.push({ scope, path, kind: 'localSecretValue', name });
}
const tracked = git('ls-files', '-z').split('\0').filter(Boolean);
for (const path of tracked) if (fs.existsSync(path) && fs.statSync(path).isFile()) scan(path, fs.readFileSync(path, 'utf8'), 'tracked');
const report = {
  checkedAt: new Date().toISOString(), target: target.origin,
  repository: git('remote', 'get-url', 'origin'), branch: git('branch', '--show-current'), localSha: git('rev-parse', 'HEAD'),
  localSupabaseRef: localRef, localEnvNames: Object.keys(env).sort(),
  localMigrationVersions: fs.readdirSync('supabase/migrations').filter(p => p.endsWith('.sql')).map(p => p.split('_')[0]).sort(),
  trackedFilesScanned: tracked.length,
};
async function get(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  return { response: r, text: await r.text() };
}
try {
  const page = await get(target);
  report.page = { status: page.response.status, finalUrl: page.response.url, sha256: sha256(page.text) };
  scan(target.pathname, page.text, 'liveHtml');
  const assets = [...new Set([...page.text.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => new URL(m[1].replaceAll('&amp;', '&'), page.response.url).href))];
  report.scripts = [];
  const liveRefs = new Set(refs(page.text));
  let publicKey;
  for (const url of assets) {
    if (new URL(url).origin !== new URL(page.response.url).origin) continue;
    const asset = await get(url);
    report.scripts.push({ path: new URL(url).pathname, status: asset.response.status, sha256: sha256(asset.text) });
    scan(new URL(url).pathname, asset.text, 'liveClient');
    refs(asset.text).forEach(ref => liveRefs.add(ref));
    publicKey ||= asset.text.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0];
  }
  report.liveSupabaseRefs = [...liveRefs];
  report.liveMatchesLocal = liveRefs.size === 1 && liveRefs.has(localRef);
  // Only contact the local project when the deployed bundle confirms that ref.
  if (report.liveMatchesLocal && publicKey) {
    const r = await fetch(`https://${localRef}.supabase.co/auth/v1/settings`, { headers: { apikey: publicKey }, signal: AbortSignal.timeout(20000) });
    const settings = await r.json();
    report.publicAuthSettings = { status: r.status, disableSignup: settings.disable_signup, mailerAutoconfirm: settings.mailer_autoconfirm, emailProvider: settings.external?.email };
  }
} catch (error) { report.networkError = { name: error.name, message: error.message }; }
report.secretScan = { findings, limits: 'Heuristic patterns plus exact local non-public credential matching. Only initial-page scripts are fetched; lazy chunks, server environment and git history are outside scope.' };
console.log(JSON.stringify(report, null, 2));
if (report.networkError || report.page?.status !== 200 || !report.liveMatchesLocal || findings.length || report.scripts?.some(s => s.status !== 200)) process.exitCode = 1;
