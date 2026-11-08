// These are working/historical working databases, never disposable Preview targets.
const workingProjects = new Set(['rnstsczayhzrxzcstzpr', 'ruejyiromtthygqtpcsy']);

/** @param {{siteUrl?: string, deploymentUrl?: string, development?: boolean}} [options] */
export function siteOrigin({siteUrl, deploymentUrl, development = false} = {}) {
  const value = siteUrl || (deploymentUrl ? `https://${deploymentUrl}` : development ? 'http://localhost:3000' : 'https://www.hr-ai.tech');
  let url;
  try { url = new URL(value); } catch { throw new Error('Site URL must be a valid absolute origin.'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(development && local && url.protocol === 'http:')) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Site URL must be an HTTPS origin without credentials, path, query or fragment.');
  }
  return url.origin;
}

export function validatePreviewEnvironment(env) {
  const errors = [];
  let database;
  try { database = new URL(env.NEXT_PUBLIC_SUPABASE_URL); } catch { errors.push('Preview requires NEXT_PUBLIC_SUPABASE_URL.'); }
  const ref = env.PREVIEW_SUPABASE_PROJECT_REF;
  if (!ref || !/^[a-z]{20}$/.test(ref)) errors.push('Declare the separate PREVIEW_SUPABASE_PROJECT_REF.');
  if (database && (database.protocol !== 'https:' || database.hostname !== `${ref}.supabase.co` || database.username || database.password || database.pathname !== '/' || database.search || database.hash)) errors.push('Preview database URL must match the declared separate Supabase project.');
  if (workingProjects.has(ref) || (database && workingProjects.has(database.hostname.split('.')[0]))) errors.push('A working Supabase project cannot be used for Preview.');
  if (!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) errors.push('Preview requires its own publishable key.');
  if (!env.NEXT_PUBLIC_SITE_URL && !env.VERCEL_URL) errors.push('Preview requires its own site origin or VERCEL_URL.');
  try {
    const origin = siteOrigin({siteUrl: env.NEXT_PUBLIC_SITE_URL, deploymentUrl: env.VERCEL_URL});
    if (['hr-ai.tech', 'www.hr-ai.tech', 'headhunter-preview.vercel.app'].includes(new URL(origin).hostname)) errors.push('Preview must not use the official or historical site origin.');
  } catch (error) { errors.push(error.message); }
  if (env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_SUPABASE_DB_PASS) errors.push('Do not inherit privileged database credentials into this Preview.');
  return errors;
}
