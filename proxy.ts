import {NextResponse,type NextRequest} from 'next/server';
import {LANGUAGE_KEY,siteLanguage} from './lib/site-language.mjs';
import {publicPageIndexable} from './lib/public-seo.mjs';
export function proxy(request:NextRequest){
 const url=request.nextUrl;
 // Shared-job metadata stays request-time and RLS checked; no job/auth data is cached.
 if(url.pathname==='/'&&url.searchParams.has('job'))return NextResponse.next();
 const language=siteLanguage(request.cookies.get(LANGUAGE_KEY)?.value);
 const response=url.pathname==='/'?NextResponse.rewrite(new URL('/'+language+url.search,request.url)):NextResponse.next();
 const index=url.pathname==='/'&&publicPageIndexable(Object.fromEntries(url.searchParams),process.env.VERCEL_ENV);
 response.headers.set('X-Robots-Tag',index?'index, follow':'noindex, nofollow');
 return response;
}
export const config={matcher:['/','/en','/he']};
