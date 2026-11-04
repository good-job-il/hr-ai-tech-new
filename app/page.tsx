import type {Metadata} from 'next';import Home from './home';import {createClient} from '@supabase/supabase-js';import {jobShare} from '../lib/job-sharing.mjs';
type Query=Promise<Record<string,string|string[]|undefined>>;
export async function generateMetadata({searchParams}:{searchParams:Query}):Promise<Metadata>{
 const params=await searchParams,base=process.env.NEXT_PUBLIC_SITE_URL||'https://headhunter-preview.vercel.app';const generic:Metadata={title:'HeadHunter — משרות והזדמנויות',description:'חיפוש משרות, פרופיל מקצועי והגשת מועמדות דרך HeadHunter.',metadataBase:new URL(base)};
 const id=typeof params.job==='string'?params.job:'';if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return generic;
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;if(!url||!key)return generic;const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),external=params.source==='external';
 const query=external?db.from('external_jobs').select('id,title,location,description').eq('id',id).eq('publication_status','published'):db.from('jobs').select('id,title,location,description').eq('id',id).eq('status','open');
 const result=await query.maybeSingle();if(result.error||!result.data)return generic;const job={...result.data,external};const share=jobShare(job,{baseUrl:base});const description=String(job.description??'').replace(/https?:\/\/\S+|www\.\S+|[\w.+-]+@[\w.-]+\.\w+/gi,'').replace(/\s+/g,' ').trim().slice(0,180)||share.text;const title=share.title+' | HeadHunter';
 return {...generic,title,description,alternates:{canonical:share.url},openGraph:{type:'website',siteName:'HeadHunter',title,description,url:share.url,images:[{url:'/brand-icon.jpg',alt:'HeadHunter'}]},twitter:{card:'summary',title,description,images:['/brand-icon.jpg']}};
}
export default function Page(){return <Home/>}
