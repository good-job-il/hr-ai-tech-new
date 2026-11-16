import {notFound} from 'next/navigation';
import ReviewClient from '../../client-portal/review-client';
export const dynamic='force-dynamic';
export default async function ClientInboxReview({searchParams}:{searchParams:Promise<{screen?:string}>}){if(process.env.CLIENT_PORTAL_REVIEW!=='1'||process.env.VERCEL)notFound();return <ReviewClient screen={(await searchParams).screen}/>}
