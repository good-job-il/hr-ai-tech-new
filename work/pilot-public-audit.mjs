import {writeFile} from 'node:fs/promises';
const base='https://ruejyiromtthygqtpcsy.supabase.co/rest/v1/';
const headers={apikey:'sb_publishable_nC_BOvsr0MXihqHrFGx-_Q_AisoEG3y',Prefer:'count=exact'};
const results=[];
for(const table of ['public_job_catalog','candidates','candidate_profiles','candidate_documents','client_presentations','client_feedback','memberships','placement_employment']){
 const start=performance.now();const r=await fetch(base+table+'?select=*&limit=1',{headers});const body=await r.json();
 results.push({check:table,status:r.status,ms:Math.round(performance.now()-start),count:r.headers.get('content-range'),privateDenied:table==='public_job_catalog'?undefined:!r.ok||(Array.isArray(body)&&body.length===0)});
}
await writeFile('work/pilot-public-audit-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
if(results.some(r=>r.privateDenied===false))process.exitCode=1;
