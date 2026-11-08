import type { NextConfig } from 'next';
const config: NextConfig = { distDir:process.env.HH_BUILD_DIR||'.next',poweredByHeader:false, async headers(){return [{source:'/:path*',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'},{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'}]},...(process.env.VERCEL_ENV==='production'?[{source:'/',headers:[{key:'X-Robots-Tag',value:'index, follow'}]}]:[])];} };
export default config;
