export default function EnvironmentNotice({lang}:{lang:'he'|'en'}) {
 const environment=process.env.NEXT_PUBLIC_DEPLOYMENT_ENV;
 if(!['preview','development'].includes(environment??''))return null;
 return <div className="stage">◉ {environment==='preview'?'Preview':lang==='he'?'פיתוח מקומי':'Local development'} · {lang==='he'?'גרסה לבדיקה':'Version for review'}</div>;
}
