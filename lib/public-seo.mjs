export const PUBLIC_SITE_URL = 'https://www.hr-ai.tech';

export function publicSiteUrl(configured) {
 try {
  const url = new URL(configured || PUBLIC_SITE_URL);
  if (url.protocol === 'https:' && !url.username && !url.password) return url.origin;
 } catch {}
 return PUBLIC_SITE_URL;
}

export function publicPageIndexable(params, environment, publishedJob = false) {
 if (environment !== 'production') return false;
 // Only the public landing page and verified published job details are indexable.
 // Workspace, auth, invitation and arbitrary application-state URLs are excluded.
 const allowed = new Set(['job','source','utm_source','utm_medium','utm_campaign','utm_term','utm_content','release_check']);
 if (Object.keys(params).some(key => !allowed.has(key))) return false;
 if (params.job || params.source) return publishedJob;
 return true;
}
