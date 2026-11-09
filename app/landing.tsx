'use client';
import {useRef} from 'react';
import BrandIcon from './brand-icon';
import BrandWordmark from './brand-wordmark';
import CareerHeroArt from './career-hero-art';
import PublicHeader from './public-header';
import UiIcon from './ui-icon';
import ReferenceIcon from './reference-icon';
import {CandidateFAQ} from './public-discovery';
import {siteLanguageCopy} from '../lib/site-language.mjs';
import type {ReactNode} from 'react';

export default function Landing({lang,heroSearch,featured,onAuth,onTab,onLanguage,signedIn,accountView='dashboard',jobCount,connected}:{
 accountView?:'dashboard'|'team'|'admin';lang:'he'|'en';children:ReactNode;heroSearch?:ReactNode;featured?:ReactNode;fields?:ReactNode;companies?:ReactNode;
 onAuth:()=>void;onTab:(tab:string)=>void;onLanguage:()=>void;signedIn:boolean;jobCount:number;connected:boolean;
}){
 const tr=(he:string,en:string)=>lang==='he'?he:en;
 const faq=useRef<HTMLDialogElement>(null);
 const help=()=>signedIn?window.dispatchEvent(new Event('hh-open-help')):onTab('support');
 const unavailable=(he:string,en:string)=><span className="unpublishedLink" aria-disabled="true" title={tr('טרם פורסם','Not published yet')}>{tr(he,en)}</span>;
 const features=[
  ['robot','violet','AI אישי לקריירה שלך','Personal career AI','כלים מתוכננים להתאמת משרות לפי הניסיון, הכישורים והיעדים שלך.','Planned tools to match roles to your experience, skills and goals.'],
  ['bolt','orange','תהליך מהיר ופשוט','A quick, simple process','מגישים מועמדות בקלות ומתקדמים לעבר המשרה הבאה.','Apply with ease and move towards your next role.'],
  ['admin','green','משרות איכותיות בלבד','Quality opportunities','משרות עדכניות עם פרטי התפקיד והחברה במקום אחד.','Current opportunities with role and company details in one place.'],
  ['notifications','blue','התראות בזמן אמת','Application updates','צופים בעדכונים ובסטטוסים שתועדו במועמדויות שלך.','View updates and statuses recorded in your applications.'],
  ['trending','coral','קידום הקריירה שלך','Grow your career','כלים, טיפים ותובנות שיעזרו לך להתקדם מהר יותר.','Tools, tips and insights to help you move forward.'],
 ];
 const tools=[
  ['trending','orange','תובנות קריירה','Career insights','דוחות אישיים והמלצות לקידום הקריירה שלך.','Personal insights and recommendations for your career.','לכלי התובנות','Explore insights'],
  ['chat','green','הכנה לראיונות','Interview preparation','תרגול שאלות ראיון וקבלת משוב לשיפור הביטחון.','Practise interview questions and build confidence.','לכלי ההכנה','Prepare for interviews'],
  ['target','violet','התאמת משרות חכמה','Smart job matching','משרות שמתאימות לפרופיל ולמטרות הקריירה שלך.','Find roles that suit your profile and career goals.','לכלי ההתאמה','Explore matching'],
  ['mine','violet','שדרוג קורות חיים','Improve your CV','כלים לשיפור קורות החיים והצגת הניסיון המקצועי שלך.','Tools to improve your CV and present your experience.','לכלי השדרוג','Improve your CV'],
 ];
 const steps=[
  ['person-plus','יוצרים פרופיל','Create a profile','מעלים קורות חיים וממלאים פרטים בסיסיים.','Upload your CV and add your basic details.'],
  ['brain','התאמה עבורך','Find your match','מגדירים תחומי עניין ובוחרים משרות מתאימות.','Set your interests and choose suitable opportunities.'],
  ['send','מגישים בקליק','Apply with a click','שולחים מועמדות למשרות שבחרת ועוקבים אחריהן.','Apply to your chosen roles and follow your applications.'],
  ['rocket','מתקדמים לקריירה','Move your career forward','עוקבים אחר ההתקדמות ומתקדמים לתפקיד הבא שלך.','Follow your progress towards your next role.'],
 ];
 const metrics=[['team','—','מועמדים פעילים','Active candidates'],['employers','—','חברות מגייסות','Hiring companies'],['jobs',connected?jobCount.toLocaleString(lang==='he'?'he-IL':'en-US'):'—','משרות פתוחות','Open positions'],['trophy','—','שביעות רצון מועמדים','Candidate satisfaction']];
 return <div className="landing landingV2 landingTech landingPrecision" dir={siteLanguageCopy(lang).direction}>
  <PublicHeader variant="tech" accountView={accountView} lang={lang} signedIn={signedIn} onTab={onTab} onAuth={onAuth} onLanguage={onLanguage}/>
  <section className="careerHero">
   <div className="careerHeroCopy"><span className="heroPill"><UiIcon name="career" size={14}/>{tr('פלטפורמת גיוס וקריירה בישראל','Your recruitment and career platform in Israel')}</span><h1>{tr('הקריירה שלך','Your career')}<br/><em>{tr('מתחילה כאן.','starts here.')}</em></h1>
    <p>{tr('משרות איכותיות, התאמה אישית, תהליך פשוט ומהיר —','Quality opportunities, a personal approach, a simple process —')}<br/>{tr('כל מה שצריך כדי למצוא את העבודה הבאה שלך.','everything you need to find your next job.')}</p>
    <div className="heroButtons"><a className="gradientButton" href="#positions"><UiIcon name="search"/>{tr('חיפוש משרות','Search jobs')}</a><button className="outlineButton" onClick={onAuth}><UiIcon name="person-plus"/>{signedIn?tr('לחשבון שלי','My account'):tr('הרשמה כמועמד חדש','Register as a candidate')}</button></div>
    <div className="heroCommunity"><span className="communityPortraits" aria-hidden="true"><i/><i/><i/><i/><b>+</b></span><span>{tr('ההזדמנות הבאה שלך מתחילה בפרופיל אחד.','Your next opportunity starts with one profile.')}</span></div>
   </div><CareerHeroArt lang={lang}/>
  </section>
  <div className="landingBody">
   <section id="benefits" className="benefits"><h2>{lang==='he'?<>למה מועמדים בוחרים <span className="benefitsBrandPhrase" dir="rtl"><span>ב</span><BrandWordmark/><span className="benefitsQuestion">?</span></span></>:<>Why do candidates choose <span className="benefitsBrandPhrase" dir="ltr"><BrandWordmark/><span className="benefitsQuestion">?</span></span></>}</h2><div className="benefitGrid">{features.map(([icon,tint,he,en,descriptionHe,descriptionEn],i)=><article className={'benefit tint-'+tint} key={icon}>{i===0&&<span className="featureSoon">{tr('בקרוב','Soon')}</span>}<span className="featureIcon"><ReferenceIcon name={icon}/></span><h3>{tr(he,en)}</h3><p>{tr(descriptionHe,descriptionEn)}</p></article>)}</div></section>
   <section id="positions" className="jobSearchPanel approvedSearch"><h2>{tr('חפש משרות שמתאימות לך','Find opportunities that suit you')}</h2>{heroSearch}</section>
   {featured}
   <section id="career" className="careerTools"><div className="careerIntro"><span className="planned">{tr('בקרוב','Coming soon')}</span><h2>{tr('מרכז לקריירה','Career center')}</h2><p>{tr('סט כלים חכמים לשדרוג הסיכויים שלך לקבל את העבודה הבאה.','Smart tools to help you prepare for your next opportunity.')}</p><button className="gradientButton" onClick={()=>onTab('career')}><UiIcon name="career"/>{tr('למרכז הקריירה','Explore career tools')}</button></div>{tools.map(([icon,tint,he,en,descriptionHe,descriptionEn,actionHe,actionEn])=><article className={'tint-'+tint} key={he}><span className="featureIcon"><ReferenceIcon name={'tool-'+icon}/></span><h3>{tr(he,en)}</h3><p>{tr(descriptionHe,descriptionEn)}</p><button className="toolLink" onClick={()=>onTab('career')}>{tr(actionHe,actionEn)}<UiIcon name="arrow-forward" size={13}/></button><small>{tr('בקרוב','Coming soon')}</small></article>)}</section>
   <section className="platformMetrics" aria-label={tr('נתוני הפלטפורמה','Platform figures')}>{metrics.map(([icon,value,he,en])=><article key={icon}><ReferenceIcon name={'metric-'+icon}/><strong dir="ltr" aria-label={value==='—'?tr('נתון טרם פורסם','Figure not published yet'):undefined}>{value}</strong><span>{tr(he,en)}</span></article>)}</section>
   <section id="how" className="howItWorks"><h2>{tr('איך זה עובד?','How does it work?')}</h2><div className="steps">{steps.map(([icon,he,en,descriptionHe,descriptionEn],i)=><article key={icon}><span className="stepNumber">{i+1}</span><ReferenceIcon name={'step-'+icon}/><h3>{tr(he,en)}</h3><p>{tr(descriptionHe,descriptionEn)}</p></article>)}</div></section>
   <section className="joinBanner"><div><h2>{tr('מוכן לעשות את הצעד הבא בקריירה שלך?','Ready for the next step in your career?')}</h2><p>{tr('ההזדמנות הבאה שלך מתחילה כאן, דרך hr-ai.tech.','Your next opportunity starts here, with hr-ai.tech.')}</p></div><button className="outlineButton" onClick={onAuth}><UiIcon name="person-plus"/>{signedIn?tr('לחשבון שלי','My account'):tr('הרשמה כמועמד חדש','Register as a candidate')}</button></section>
  </div>
  <footer className="publicFooter"><div className="footerTop">
   <div className="footerBrand"><a className="publicBrand" href="/"><BrandIcon/><BrandWordmark/></a><p>{tr('פלטפורמת גיוס וקריירה בישראל. משרות איכותיות, פרופיל מקצועי וכלים חכמים לקידום הקריירה שלך.','A recruitment and career platform in Israel. Quality opportunities, a professional profile and tools for your next step.')}</p><div className="footerSocials" aria-label={tr('ערוצים חברתיים — בקרוב','Social channels — coming soon')}>{['linkedin','facebook','instagram','whatsapp','youtube'].map(icon=><span aria-disabled="true" title={tr('בקרוב','Coming soon')} key={icon}><ReferenceIcon name={'social-'+icon}/></span>)}</div></div>
   <div><b>{tr('למועמדים','For candidates')}</b><a href="#positions">{tr('חיפוש משרות','Search jobs')}</a><button onClick={onAuth}>{tr('פרופיל אישי','My profile')}</button><button onClick={()=>onTab('career')}>{tr('התאמות AI','AI matching')}</button><button onClick={()=>onTab('career')}>{tr('קורות חיים','CV tools')}</button><a href="#career">{tr('מרכז AI לקריירה','AI career center')}</a></div>
   <div><b>{tr('לחברות','For companies')}</b><button onClick={()=>onTab('employers')}>{tr('פרסום משרה','Post a job')}</button><button onClick={()=>onTab('employers')}>{tr('חיפוש עובדים','Find candidates')}</button><button onClick={()=>onTab('career')}>AI Matching</button>{unavailable('אנליטיקה','Analytics')}<button onClick={()=>onTab('employers')}>{tr('פתרונות לעסקים','Business solutions')}</button></div>
   <div><b>{tr('חברה','Company')}</b><a href="#benefits">{tr('אודות','About')}</a>{unavailable('קריירה','Careers')}{unavailable('בלוג','Blog')}<button onClick={help}>{tr('צור קשר','Contact')}</button>{unavailable('מדיה','Media')}</div>
   <div id="resources"><b>{tr('תמיכה','Support')}</b><button onClick={help}>{tr('מרכז עזרה','Help center')}</button><button onClick={()=>faq.current?.showModal()}>{tr('שאלות נפוצות','Frequently asked questions')}</button>{unavailable('מדריכים','Guides')}{unavailable('סטטוס מערכת','System status')}</div>
  </div><div className="footerBottom"><bdi dir="ltr">© {new Date().getFullYear()} hr-ai.tech</bdi><div>{unavailable('תנאי שימוש','Terms of use')}<span aria-hidden="true"> | </span>{unavailable('מדיניות פרטיות','Privacy policy')}</div><button className="footerLanguage" title={tr('Switch to English','מעבר לעברית')} onClick={onLanguage}><ReferenceIcon name="globe"/>{tr('עברית','English')}</button></div></footer>
  <dialog className="landingFaqDialog" ref={faq} aria-label={tr('שאלות נפוצות','Frequently asked questions')}><button className="faqClose" onClick={()=>faq.current?.close()} aria-label={tr('סגירה','Close')}>×</button><CandidateFAQ lang={lang}/></dialog>
 </div>;
}
