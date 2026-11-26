import {notFound} from 'next/navigation';
import HistoryReview from './review';
export default function Page(){if(process.env.NODE_ENV!=='development')notFound();return <HistoryReview/>}
