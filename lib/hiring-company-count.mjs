import {withoutNiqqud} from './hebrew-text.mjs';

// Input is the complete anonymous public catalog, never private workspace jobs.
export function countHiringCompanies(jobs){
 const names=new Set();
 for(const job of jobs){
  const name=job.organization?.name;
  if(typeof name!=='string')continue;
  const key=withoutNiqqud(name).normalize('NFC').trim().replace(/\s+/gu,' ').toLowerCase();
  if(key)names.add(key);
 }
 return names.size;
}
