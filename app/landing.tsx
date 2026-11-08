'use client';
import {useRef} from 'react';
import BrandIcon from './brand-icon';
import BrandWordmark from './brand-wordmark';
import CareerHeroArt from './career-hero-art';
import PublicHeader from './public-header';
import UiIcon from './ui-icon';
import {CandidateFAQ} from './public-discovery';
import {siteLanguageCopy} from '../lib/site-language.mjs';
import type {ReactNode} from 'react';

export default function Landing({lang,heroSearch,featured,onAuth,onTab,onLanguage,signedIn,accountView='dashboard'}:{
 accountView?:'dashboard'|'team'|'admin';lang:'he'|'en';children:ReactNode;heroSearch?:ReactNode;featured?:ReactNode;fields?:ReactNode;companies?:ReactNode;
 onAuth:()=>void;onTab:(tab:string)=>void;onLanguage:()=>void;signedIn:boolean;jobCount:number;connected:boolean;
}){
 const tr=(he:string,en:string)=>lang==='he'?he:en;
 const faq=useRef<HTMLDialogElement>(null);
 const help=()=>signedIn?window.dispatchEvent(new Event('hh-open-help')):onTab('support');
 const unavailable=(he:string,en:string)=><span className="unpublishedLink" aria-disabled="true" title={tr('טרם פורסם','Not published yet')}>{tr(he,en)}</span>;
 const features=[
  ['bolt','תהליך ברור ופשוט','A clear, simple process','איתור משרות, הגשת מועמדות ומעקב, בצורה קלה ונגישה.','Find jobs, apply and follow your progress with ease.'],
  ['jobs','משרות במקום אחד','Jobs in one place','מגוון משרות עדכניות בישראל במקום מרכזי ונוח.','Explore available jobs in Israel in one convenient place.'],
  ['notifications','מעקב אחר מועמדות','Application tracking','עדכון סטטוס וניהול מועמדויות שלך בקלות.','View recorded statuses and manage your applications.'],
  ['badge','הפרופיל שלך','Your profile','ניהול פרטים, ניסיון, השכלה וכישורים במקום אחד.','Manage your details, experience, education and skills in one place.'],
 ];
 const tools=[['chart','תובנות קריירה','Career insights'],['target','הכנה לראיונות','Interview preparation'],['mine','תכנון קריירה','Career planning']];
 const promises=[
  ['search','חיפוש ממוקד','Focused search','איתור משרות רלוונטיות לפי תחום, תפקיד ואזור','Find relevant roles by field, role and region'],
  ['person','פרופיל מקצועי','Professional profile','הצגת ניסיון, השכלה וכישורים בצורה מסודרת','Present your experience, education and skills clearly'],
  ['calendar','מעקב מועמדויות','Application tracking','ניהול ומעקב אחר כל ההגשות שלך','Manage and follow all your applications'],
 ];
 const steps=[
  ['person','יוצרים פרופיל','Create a profile','פותחים פרופיל אישי ומזינים את הפרטים הרלוונטיים','Create your profile and add your relevant details'],
  ['search','מוצאים משרה','Find a job','מחפשים ומגלים משרות שמתאימות לך','Search and discover roles that suit you'],
  ['send','מגישים מועמדות','Apply for a job','שולחים מועמדות בקלות למשרה שבחרת','Submit your application for your chosen role'],
  ['notifications','עוקבים אחר ההתקדמות','Follow your progress','מקבלים עדכונים ומנהלים את המועמדויות שלך','View recorded updates and manage your applications'],
 ];
 return <div className="landing landingV2 landingExact" dir={siteLanguageCopy(lang).direction}>
  <PublicHeader variant="mockup" accountView={accountView} lang={lang} signedIn={signedIn} onTab={onTab} onAuth={onAuth} onLanguage={onLanguage}/>
  <section className="careerHero">
   <div className="careerHeroCopy"><h1>{tr('הקריירה שלך','Your career')}<br/><em>{tr('מתחילה כאן.','starts here.')}</em></h1>
    <p>{tr('חיפוש עבודה בישראל לפי תפקיד, תחום ועיר.','Find jobs in Israel by role, field and city.')}<br/>{tr('משרות פנויות, פרופיל אישי ומעקב אחר המועמדויות שלך.','Open positions, a professional profile and application tracking.')}</p>
    <div className="heroButtons"><a className="gradientButton" href="#positions"><UiIcon name="search"/>{tr('חיפוש משרות','Search jobs')}</a><button className="outlineButton" onClick={onAuth}><UiIcon name="person"/>{signedIn?tr('לחשבון שלי','My account'):tr('יצירת פרופיל','Create profile')}</button></div>
   </div><CareerHeroArt lang={lang}/>
  </section>
  <div className="landingBody">
   <section id="benefits" className="benefits" aria-label={tr('יתרונות הפלטפורמה','Platform benefits')}><div className="benefitGrid">{features.map(([icon,he,en,descriptionHe,descriptionEn])=><article className="benefit" key={icon}><UiIcon name={icon} size={32}/><h3>{tr(he,en)}</h3><p>{tr(descriptionHe,descriptionEn)}</p></article>)}</div></section>
   <section id="positions" className="jobSearchPanel approvedSearch"><h2>{tr('חיפוש עבודה ומשרות בישראל','Find jobs in Israel')}</h2>{heroSearch}</section>
   {featured}
   <section id="career" className="careerTools"><div className="careerIntro"><span className="planned">{tr('בקרוב','Coming soon')}</span><h2>{tr('כלי קריירה','Career tools')}</h2><p>{tr('כלים שיעזרו לך בתכנון ופיתוח הקריירה שלך, בהמשך.','Tools to help plan and develop your career, coming later.')}</p></div>{tools.map(([icon,he,en])=><article key={icon}><UiIcon name={icon} size={32}/><h3>{tr(he,en)}</h3><span className="toolSoon">{tr('בקרוב','Coming soon')}</span></article>)}</section>
   <section className="careerPromises" aria-label={tr('הכלים שלך לחיפוש עבודה','Your job search tools')}>{promises.map(([icon,he,en,descriptionHe,descriptionEn])=><article key={icon}><UiIcon name={icon} size={30}/><h3>{tr(he,en)}</h3><p>{tr(descriptionHe,descriptionEn)}</p></article>)}</section>
   <section id="how" className="howItWorks"><h2>{tr('איך זה עובד?','How does it work?')}</h2><div className="steps">{steps.map(([icon,he,en,descriptionHe,descriptionEn],i)=><article key={icon}><span className="stepNumber">{i+1}</span><UiIcon name={icon} size={32}/><h3>{tr(he,en)}</h3><p>{tr(descriptionHe,descriptionEn)}</p></article>)}</div></section>
   <section className="joinBanner"><div><h2>{tr('מוכן לעשות את הצעד הבא בקריירה שלך?','Ready for the next step in your career?')}</h2><p>{tr('פתח פרופיל, חפש משרות מתאימות והתחל בקידום הקריירה שלך.','Create a profile, find suitable roles and take your career forward.')}</p></div><button className="outlineButton" onClick={onAuth}><UiIcon name="person"/>{signedIn?tr('לחשבון שלי','My account'):tr('יצירת פרופיל','Create profile')}</button></section>
  </div>
  <footer className="publicFooter"><div className="footerTop">
   <div className="footerBrand"><a className="publicBrand" href="/"><BrandIcon/><BrandWordmark/></a></div>
   <div><b>{tr('למועמדים','For candidates')}</b><a href="#positions">{tr('חיפוש משרות','Search jobs')}</a><button onClick={onAuth}>{tr('יצירת פרופיל','Create a profile')}</button><button onClick={()=>signedIn?onTab('mine'):onAuth()}>{tr('מעקב מועמדויות','Application tracking')}</button><a href="#career">{tr('כלי קריירה','Career tools')}</a></div>
   <div><b>{tr('למעסיקים','For employers')}</b><button onClick={()=>onTab('employers')}>{tr('פרסום משרה','Post a job')}</button><button onClick={()=>onTab('employers')}>{tr('חיפוש עובדים','Find candidates')}</button><button onClick={()=>signedIn&&accountView!=='dashboard'?onTab(accountView):onTab('employers')}>{tr('ניהול משרות','Manage jobs')}</button><button onClick={()=>onTab('employers')}>{tr('פתרונות גיוס','Recruitment solutions')}</button></div>
   <div><b>{tr('חברה','Company')}</b><a href="#benefits">{tr('אודות','About')}</a>{unavailable('בלוג','Blog')}<a href="#how">{tr('איך זה עובד','How it works')}</a><button onClick={help}>{tr('צור קשר','Contact')}</button></div>
   <div><b>{tr('עזרה','Help')}</b><button onClick={()=>faq.current?.showModal()}>{tr('שאלות נפוצות','Frequently asked questions')}</button><button onClick={help}>{tr('מרכז עזרה','Help center')}</button>{unavailable('תנאי שימוש','Terms of use')}{unavailable('מדיניות פרטיות','Privacy policy')}</div>
  </div><div className="footerBottom"><bdi dir="ltr">© {new Date().getFullYear()} hr-ai.tech</bdi><div>{unavailable('מדיניות פרטיות','Privacy policy')}<span aria-hidden="true"> | </span>{unavailable('תנאי שימוש','Terms of use')}</div></div></footer>
  <dialog className="landingFaqDialog" ref={faq} aria-label={tr('שאלות נפוצות','Frequently asked questions')}><button className="faqClose" onClick={()=>faq.current?.close()} aria-label={tr('סגירה','Close')}>×</button><CandidateFAQ lang={lang}/></dialog>
 </div>;
}
