import {randomUUID} from 'node:crypto';

export const productionRef = 'rnstsczayhzrxzcstzpr';
const buckets = ['candidate-cvs', 'organization-cvs'];

// Operator tooling only. Never import this module into browser code.
export function serverConfigurationErrors(env) {
 const errors = [];
 if (env.NEXT_PUBLIC_SUPABASE_URL !== `https://${productionRef}.supabase.co`)
  errors.push('NEXT_PUBLIC_SUPABASE_URL must identify the HR-21 Production project.');
 if (env.NEXT_PUBLIC_SITE_URL !== 'https://www.hr-ai.tech')
  errors.push('NEXT_PUBLIC_SITE_URL must be https://www.hr-ai.tech.');
 if (!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY === env.SUPABASE_SECRET_KEY)
  errors.push('A separate public publishable key is required.');
 if (!/^sb_secret_[A-Za-z0-9_-]+$/.test(env.SUPABASE_SECRET_KEY || ''))
  errors.push('SUPABASE_SECRET_KEY must contain a Supabase server secret key.');
 if (env.VERCEL_ENV && env.VERCEL_ENV !== 'production')
  errors.push('This Production check must not run in Preview or Development on Vercel.');
 for (const [name, expected] of [['VERCEL_GIT_REPO_OWNER', 'good-job-il'], ['VERCEL_GIT_REPO_SLUG', 'hr-ai-tech-new']])
  if (env[name] && env[name] !== expected) errors.push('Vercel Git repository does not match HR-21.');
 if (Object.entries(env).some(([name, value]) => name.startsWith('NEXT_PUBLIC_') && value &&
  (/secret|service_role/i.test(name) || /sb_secret_/.test(value) || (env.SUPABASE_SECRET_KEY && value.includes(env.SUPABASE_SECRET_KEY)))))
  errors.push('Privileged credentials must not appear in NEXT_PUBLIC_ variables.');
 return errors;
}

// A small valid PDF containing only a fixed synthetic QA label, with computed xref.
export function syntheticPdf() {
 const content = 'BT /F1 12 Tf 20 40 Td (HR-21 synthetic QA - no personal data) Tj ET\n';
 const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 100] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`,
 ];
 let pdf = '%PDF-1.4\n';
 const offsets = [0];
 objects.forEach((object, i) => {offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;});
 const xref = Buffer.byteLength(pdf);
 pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return Buffer.from(pdf);
}

/** Only touches freshly generated QA paths. Never accepts an existing CV path. */
export async function probeServerStorage(client) {
 const report = [];
 const bytes = syntheticPdf();
 for (const bucket of buckets) {
  const path = `hr-21-configuration-qa/${randomUUID()}.pdf`;
  const storage = client.storage.from(bucket);
  let stage = 'bucket', failure, cleanup = false, uploadAttempted = false;
  try {
   const metadata = await client.storage.getBucket(bucket);
   if (metadata.error || !metadata.data || metadata.data.public !== false) throw new Error();
   stage = 'upload';
   uploadAttempted = true;
   const uploaded = await storage.upload(path, bytes, {contentType:'application/pdf', cacheControl:'0', upsert:false});
   if (uploaded.error) throw new Error();
   stage = 'download';
   const downloaded = await storage.download(path);
   if (downloaded.error || !downloaded.data || !bytes.equals(Buffer.from(await downloaded.data.arrayBuffer()))) throw new Error();
  } catch {
   // Supabase/network errors can contain request details. Never log them.
   failure = stage;
  } finally {
   if (uploadAttempted) {
    try {
     const removed = await storage.remove([path]);
     cleanup = !removed.error && removed.data?.some(object => object.name === path) === true;
    } catch {cleanup = false;}
   }
  }
  report.push({bucket, passed:!failure && cleanup, failure:failure || null, cleanup,
   // A failed cleanup exposes only our generated, non-personal QA path for manual removal.
   ...(uploadAttempted && !cleanup ? {cleanupPath:path} : {})});
 }
 return report;
}
