// Read-only discovery. No API endpoints, database writes, signup or applications.
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {jobSources} from '../lib/job-sources.mjs';
import {parseCareerPage} from '../lib/job-source-parser.mjs';
const output=resolve(process.argv[2]||'work/source-scan');await mkdir(output,{recursive:true});
const report={scannedAt:new Date().toISOString(),mode:'read-only-html-no-api',importedJobs:0,sources:[]};
for(const source of jobSources){const result={...source};try{
 const response=await fetch(source.url,{headers:{'User-Agent':'HeadHunterSourceCheck/0.1 (public career-page verification)'},signal:AbortSignal.timeout(25000)});result.httpStatus=response.status;result.finalUrl=response.url;
 if(!response.ok){result.status='unavailable';report.sources.push(result);continue}
 const type=response.headers.get('content-type')||'';if(!type.includes('text/html'))throw Error('Not an HTML page');
 const html=await response.text();if(html.length>8000000)throw Error('Page exceeds discovery size limit');
 const parsed=parseCareerPage(html,response.url,source.company);Object.assign(result,parsed);result.status=parsed.structuredJobs.length?'structured_listings_found':parsed.candidateLinks.length?'detail_links_found':'browser_or_adapter_required';
 await writeFile(resolve(output,source.id+'.html'),html);report.sources.push(result);
 }catch(error){result.status='failed';result.error=error.message;report.sources.push(result)}
 console.log(JSON.stringify({company:source.company,status:result.status,httpStatus:result.httpStatus,structuredListings:result.structuredJobs?.length??0,detailLinks:result.candidateLinks?.length??0}));
}
await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));console.log('No jobs imported. Discovered links and structured listings are not counted as verified active vacancies.');
