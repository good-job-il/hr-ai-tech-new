import type { NextConfig } from 'next';
import {siteOrigin, validatePreviewEnvironment} from './lib/site-environment.mjs';
if(process.env.VERCEL_ENV==='preview'){
 const errors=validatePreviewEnvironment(process.env);
 if(errors.length)throw new Error('Unsafe Preview configuration:\n'+errors.join('\n'));
}
const publicSiteOrigin=siteOrigin({siteUrl:process.env.NEXT_PUBLIC_SITE_URL,deploymentUrl:process.env.VERCEL_ENV==='production'?undefined:process.env.VERCEL_URL,development:process.env.NODE_ENV==='development'});
const config: NextConfig = { env:{NEXT_PUBLIC_SITE_URL:publicSiteOrigin,NEXT_PUBLIC_DEPLOYMENT_ENV:process.env.VERCEL_ENV||(process.env.NODE_ENV==='development'?'development':'')},distDir:process.env.HH_BUILD_DIR||'.next',poweredByHeader:false, async headers(){return [{source:'/:path*',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'},{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'}]}];} };
export default config;
