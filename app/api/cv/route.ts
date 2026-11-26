import { createClient } from '@supabase/supabase-js';
import { cvHeaders, deliverCv } from '../../../lib/cv-delivery.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CvRequest = { kind: 'organization'; document: string }
  | { kind: 'presentation'; presentation: string }
  | { kind: 'candidate'; path: string };
type AuthorizedFile = { bucket: 'organization-cvs' | 'candidate-cvs'; path: string };

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !publicKey || !secret) {
    return Response.json({ error: 'CV_UNAVAILABLE' }, { status: 503, headers: cvHeaders });
  }
  return deliverCv(request, {
    async authorize(input: CvRequest, authorization: string): Promise<AuthorizedFile | null> {
      const user = createClient(url, publicKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authorization }, fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
      });
      // RPCs validate the actual JWT and current rights; never authorize with the secret client.
      if (input.kind === 'organization') {
        const r = await user.rpc('candidate_document_download', { document: input.document });
        return !r.error && typeof r.data === 'string' ? { bucket: 'organization-cvs', path: r.data } : null;
      }
      if (input.kind === 'presentation') {
        const r = await user.rpc('client_presentation_document', { presentation: input.presentation });
        return !r.error && typeof r.data?.path === 'string' ? { bucket: 'organization-cvs', path: r.data.path } : null;
      }
      const r = await user.rpc('candidate_cv_download', { path: input.path });
      return !r.error && r.data === input.path ? { bucket: 'candidate-cvs', path: r.data } : null;
    },
    async download(file: AuthorizedFile) {
      const storage = createClient(url, secret, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: (input, init) => {
          const fresh = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
          fresh.searchParams.set('cvRead', crypto.randomUUID());
          return fetch(fresh, { ...init, cache: 'no-store' });
        } },
      });
      const r = await storage.storage.from(file.bucket).download(file.path);
      return r.error ? null : r.data;
    },
  });
}
