// Private staging preparation only. Never changes publication_status to published.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {extractEditorialDraft} from '../lib/editorial-job-parser.mjs';
const dir=resolve(process.argv[2]);const input=JSON.parse(await readFile(resolve(dir,'verified-jobs.json'),'utf8')).jobs;
const output=[];
for(const job of input){if(job.source_id==='riskified')continue;
 try{const response=await fetch(job.source_url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('HTTP '+response.status);const draft=extractEditorialDraft(await response.text(),job.source_id);output.push({...job,...draft,publication_status:'draft',enriched_at:new Date().toISOString()});}
 catch(error){output.push({...job,publication_status:'draft',editorial_status:'extraction_failed',reason:error.message})}
 if(output.length%10===0){await writeFile(resolve(dir,'editorial-http-drafts.json'),JSON.stringify(output,null,2));console.log(JSON.stringify({processed:output.length,total:input.length-15}));}
 await new Promise(r=>setTimeout(r,300));
}
await writeFile(resolve(dir,'editorial-http-drafts.json'),JSON.stringify(output,null,2));console.log(JSON.stringify({processed:output.length,completeSections:output.filter(r=>r.missing_fields?.length===0).length,failed:output.filter(r=>r.editorial_status==='extraction_failed').length}));
