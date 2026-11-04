import {notFound} from 'next/navigation';
import ScreenReview from './screen-review';
export default function Screens(){if(process.env.NODE_ENV!=='development')notFound();return <ScreenReview/>}
