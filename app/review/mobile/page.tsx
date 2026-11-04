import {notFound} from 'next/navigation';import MobileHarness from './mobile-harness';
export default function MobileReview(){if(process.env.NODE_ENV!=='development')notFound();return <MobileHarness/>}
