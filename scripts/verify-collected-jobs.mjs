import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {load} from 'cheerio';
import {jobSources} from '../lib/job-sources.mjs';
const dir=resolve(process.argv[2]);
const normalize=s=>s.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const results=[];
for(const source of jobSources){
 const links=JSON.parse(await readFile(resolve(dir,source.id+'-israel.json'),'utf8'));
 if(source.id==='riskified')continue; // browser-only source, no retry of HTTP 403.
 for(const link of links){
  const lines=link.text.split('\n').map(s=>s.trim()).filter(Boolean).filter(s=>s!=='Apply');
  const record={source_id:source.id,company:source.company,source_url:link.url,title:source.id==='elementor'?lines[1]:lines[0],location:source.id==='elementor'?lines[0]:lines.at(-1),department:source.id==='similarweb'?lines[1]:source.id==='monday'&&lines.length>2?lines[1]:null,employment_type:source.id==='elementor'&&lines[2]?.startsWith('Full time')?'full-time':null};
  try{
   const expected=new URL(link.url);if(!['monday.com','job-boards.greenhouse.io','boards.greenhouse.io','elementor.careers'].includes(expected.hostname))throw Error('Unapproved source host');
   const response=await fetch(link.url,{signal:AbortSignal.timeout(20000)});record.http_status=response.status;
   if(!response.ok)throw Error('HTTP '+response.status);
   if(!response.headers.get('content-type')?.includes('text/html'))throw Error('Not HTML');
   const html=await response.text(),$=load(html);$('script,style,noscript,nav,footer').remove();const text=$('body').text().replace(/\s+/g,' ');
   const headings=$('h1').map((_,e)=>$(e).text().trim()).get();
   const titlePresent=headings.some(t=>normalize(t)===normalize(record.title))||normalize(text).includes(normalize(record.title));
   const applyPresent=$('a,button,input[type="submit"]').toArray().some(e=>/\bapply\b|submit application/i.test($(e).text()+' '+($(e).attr('value')??'')));
   const closed=/this (?:job|position|role) (?:is no longer|has been filled)|no longer accepting applications|job (?:not found|has expired)|position (?:has been filled|is closed)/i.test(text);
   if(!titlePresent||!applyPresent||closed)throw Error(closed?'Closed/unavailable message':'Title or application control not confirmed');
   record.source_url=response.url;record.verified_at=new Date().toISOString();record.verification_method='public-html';record.status='verified';
  }catch(error){record.status='not_verified';record.reason=error.message}
  results.push(record);console.log(JSON.stringify({company:source.company,title:record.title,status:record.status,reason:record.reason}));
  await new Promise(r=>setTimeout(r,300));
 }
 await writeFile(resolve(dir,'verified-http.json'),JSON.stringify(results,null,2));
}
console.log(JSON.stringify({verified:results.filter(r=>r.status==='verified').length,notVerified:results.filter(r=>r.status!=='verified').length}));
