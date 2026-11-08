import type {MetadataRoute} from 'next';
import {publicSiteUrl} from '../lib/public-seo.mjs';
export default function sitemap():MetadataRoute.Sitemap {
 return process.env.VERCEL_ENV==='production'?[{url:publicSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)+'/'}]:[];
}
