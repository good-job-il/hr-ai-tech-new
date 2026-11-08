import type {MetadataRoute} from 'next';
import {publicSiteUrl} from '../lib/public-seo.mjs';
export default function robots():MetadataRoute.Robots {
 if(process.env.VERCEL_ENV!=='production')return {rules:{userAgent:'*',disallow:'/'}};
 return {rules:{userAgent:'*',allow:'/',disallow:['/api/','/review','/client-portal']},sitemap:publicSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)+'/sitemap.xml'};
}
