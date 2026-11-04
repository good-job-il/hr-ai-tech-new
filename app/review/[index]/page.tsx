import JobDetail from '../../job-detail';
import {notFound} from 'next/navigation';
import {readFile} from 'node:fs/promises';
export const dynamic='force-dynamic';
export default async function Review({params}:{params:Promise<{index:string}>}){
 if(process.env.NODE_ENV!=='development'||!process.env.HEADHUNTER_REVIEW_FILE)notFound();
 const {index}=await params;if(!/^\d+$/.test(index))notFound();
 const rows=JSON.parse(await readFile(process.env.HEADHUNTER_REVIEW_FILE,'utf8'));const row=rows[Number(index)];if(!row)notFound();
 // Explicit allowlist: source URLs and private collector metadata never reach the browser.
 const job={title:row.title,location:row.location,type:row.employment_type??'unspecified',description:row.description??'',responsibilities:row.responsibilities??'',requirements:row.requirements??'',benefits:row.benefits??'',category:row.department??'',verified_at:row.verified_at};
 return <JobDetail job={job} draft/>;
}
