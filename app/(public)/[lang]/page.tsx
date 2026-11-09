import type {Metadata} from 'next';
import Home from '../../home';
import {siteLanguage,siteLanguageCopy} from '../../../lib/site-language.mjs';
import {publicSiteUrl} from '../../../lib/public-seo.mjs';
export const dynamicParams=false;
export function generateStaticParams(){return [{lang:'en'},{lang:'he'}]}
export async function generateMetadata({params}:{params:Promise<{lang:string}>}):Promise<Metadata>{
 const language=siteLanguage((await params).lang),copy=siteLanguageCopy(language),base=publicSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
 return {title:copy.title,description:copy.description,metadataBase:new URL(base),alternates:{canonical:base+'/'},robots:{index:process.env.VERCEL_ENV==='production',follow:true},openGraph:{type:'website',siteName:'hr-ai.tech',title:copy.title,description:copy.description,url:base+'/',images:[{url:'/brand-hr-v1.png',alt:'hr-ai.tech'}]}};
}
export default async function PublicPage({params}:{params:Promise<{lang:string}>}){return <Home initialLanguage={siteLanguage((await params).lang)}/>}
