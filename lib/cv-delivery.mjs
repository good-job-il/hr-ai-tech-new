// Every read is authorized again. Never return a reusable Storage URL.
export const cvHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  Pragma: 'no-cache',
  Expires: '0',
  Vary: 'Authorization',
  'X-Content-Type-Options': 'nosniff',
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validCvRequest(value) {
  if (!value || typeof value !== 'object') return false;
  if (value.kind === 'organization') return uuid.test(value.document ?? '');
  if (value.kind === 'presentation') return uuid.test(value.presentation ?? '');
  return value.kind === 'candidate' && typeof value.path === 'string'
    && value.path.length <= 400 && uuid.test(value.path.split('/')[0])
    && /^[0-9a-f-]{36}\/[a-zA-Z0-9_-]+\.pdf$/i.test(value.path);
}

export async function deliverCv(request, { authorize, download }) {
  const fail = (status) => Response.json({ error: 'CV_UNAVAILABLE' }, { status, headers: cvHeaders });
  if (!/^Bearer [^\s]+$/i.test(request.headers.get('authorization') ?? '')) return fail(401);
  if (Number(request.headers.get('content-length') ?? 0) > 4096) return fail(413);
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 4096) return fail(413);
    const input = JSON.parse(raw);
    if (!validCvRequest(input)) return fail(400);
    const authorized = await authorize(input, request.headers.get('authorization'));
    if (!authorized) return fail(403);
    const file = await download(authorized);
    if (!file || file.size > 5242880 || file.type !== 'application/pdf') return fail(403);
    return new Response(file, { headers: { ...cvHeaders, 'Content-Type': 'application/pdf' } });
  } catch {
    return fail(403);
  }
}
