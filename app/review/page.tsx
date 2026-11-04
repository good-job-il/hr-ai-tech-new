import {notFound} from 'next/navigation';
import {readFile} from 'node:fs/promises';
export const dynamic='force-dynamic';
export default async function ReviewIndex(){
 if(process.env.NODE_ENV!=='development'||!process.env.HEADHUNTER_REVIEW_FILE)notFound();
 const rows:{title:string;location:string;missing_fields:string[]}[]=JSON.parse(await readFile(process.env.HEADHUNTER_REVIEW_FILE,'utf8'));
 return <main className="jobDetailPage" dir="rtl"><h1>טיוטות משרות לבדיקה</h1><p className="draftBanner">{rows.length} טיוטות · תצוגה מקומית בלבד · לא פורסמו · התוכן טרם עבר עריכה מלאה</p><div className="jobGrid">{rows.map((j,i)=><a className="detailPanel reviewCard" key={i} href={`/review/${i}`}><h2>{j.title}</h2><p>{j.location}</p><small>{j.missing_fields.length?'נדרשת השלמת חלוקה לסעיפים':'הסעיפים זוהו · נדרשת בדיקת תוכן'}</small><p>פתיחת טיוטה ←</p></a>)}</div></main>;
}
