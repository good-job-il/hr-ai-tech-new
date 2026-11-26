import test from 'node:test';
import assert from 'node:assert/strict';
import {GET} from '../app/review/client-inbox/sample-cv/route.ts';

test('Synthetic CV is available only in explicitly enabled local review, never Vercel',async()=>{
 const previous={review:process.env.CLIENT_PORTAL_REVIEW,vercel:process.env.VERCEL};
 try{
  delete process.env.VERCEL;delete process.env.CLIENT_PORTAL_REVIEW;
  assert.equal((await GET()).status,404);
  process.env.CLIENT_PORTAL_REVIEW='1';process.env.VERCEL='1';
  assert.equal((await GET()).status,404);
  delete process.env.VERCEL;
  const response=await GET();assert.equal(response.status,200);
  assert.equal(response.headers.get('content-type'),'application/pdf');
  assert.equal(response.headers.get('cache-control'),'no-store');
  const pdf=await response.text();assert.ok(pdf.startsWith('%PDF-1.4'));
  assert.ok(pdf.includes('Synthetic profile - not a real person'));
 }finally{
  if(previous.review===undefined)delete process.env.CLIENT_PORTAL_REVIEW;else process.env.CLIENT_PORTAL_REVIEW=previous.review;
  if(previous.vercel===undefined)delete process.env.VERCEL;else process.env.VERCEL=previous.vercel;
 }
});
