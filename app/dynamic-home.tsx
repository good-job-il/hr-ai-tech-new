import type {Metadata} from 'next';import Home from './home';import {createClient} from '@supabase/supabase-js';import {jobShare} from '../lib/job-sharing.mjs';
import {cookies} from 'next/headers';
import {LANGUAGE_KEY,siteLanguage,siteLanguageCopy,sitePageTitle} from '../lib/site-language.mjs';
import {publicSiteUrl,publicPageIndexable} from '../lib/public-seo.mjs';
import {withoutNiqqud} from '../lib/hebrew-text.mjs';
type Query=Promise<Record<string,string|string[]|undefined>>;
export async function generateMetadata({searchParams}:{searchParams:Query}):Promise<Metadata>{
 const language=siteLanguage((await cookies()).get(LANGUAGE_KEY)?.value),copy=siteLanguageCopy(language);
 const params=await searchParams,base=publicSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);const generic:Metadata={title:copy.title,description:copy.description,metadataBase:new URL(base),alternates:{canonical:base+'/'},robots:{index:publicPageIndexable(params,process.env.VERCEL_ENV),follow:true},openGraph:{type:'website',siteName:'hr-ai.tech',title:copy.title,description:copy.description,url:base+'/',images:[{url:'/brand-hr-v1.png',alt:'hr-ai.tech'}]}};
 const id=typeof params.job==='string'?params.job:'';if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return generic;
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;if(!url||!key)return generic;const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),external=params.source==='external';
 const query=external?db.from('external_jobs').select('id,title,location,description').eq('id',id).eq('publication_status','published'):db.from('jobs').select('id,title,location,description').eq('id',id).eq('status','open');
 const result=await query.maybeSingle();if(result.error||!result.data)return generic;const job={...result.data,external};const share=jobShare(job,{baseUrl:base,lang:language});const description=withoutNiqqud(job.description).replace(/https?:\/\/\S+|www\.\S+|[\w.+-]+@[\w.-]+\.\w+/gi,'').replace(/\s+/g,' ').trim().slice(0,180)||share.text;const title=sitePageTitle(language,share.title);
 return {...generic,title,description,robots:{index:publicPageIndexable(params,process.env.VERCEL_ENV,true),follow:true},alternates:{canonical:share.url},openGraph:{type:'website',siteName:'hr-ai.tech',title,description,url:share.url,images:[{url:'/brand-hr-v1.png',alt:'hr-ai.tech'}]},twitter:{card:'summary',title,description,images:['/brand-hr-v1.png']}};
}
export default async function Page(){const language=siteLanguage((await cookies()).get(LANGUAGE_KEY)?.value);return <Home initialLanguage={language}/>}
