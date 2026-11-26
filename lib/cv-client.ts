import { db } from './supabase';

export type CvRead = { kind: 'organization'; document: string }
  | { kind: 'presentation'; presentation: string }
  | { kind: 'candidate'; path: string };

export async function readCv(input: CvRead): Promise<Blob> {
  const session = await db!.auth.getSession();
  if (!session.data.session) throw new Error('CV_UNAVAILABLE');
  const response = await fetch('/api/cv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.data.session.access_token}` },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('CV_UNAVAILABLE');
  return response.blob();
}
