'use client';
import {useState} from 'react';
import ClientInbox from './client-inbox';
import EmailSignIn from './email-sign-in';
import AccountProfile from '../account-profile';
import HelpDrawer from '../help-drawer';
import WorkspaceShell,{type WorkspaceView} from './workspace-shell';
import WorkspaceHelp from './workspace-help';
import {civiProfessionalReasons} from '../../lib/client-civi-reasons.mjs';
import type {InboxData,PortalLanguage} from './inbox-types';
import '../account-center.css';
const base:InboxData={schema_version:3,clients:[{id:'sample-client',name:'חצי חינם — הדגמה',agency:'תעסוקה טובה',interview_coordinator:'client',rejection_reasons:civiProfessionalReasons.map(([label,label_en],i)=>({id:'civi-'+i,label,label_en}))}],presentations:[
 {id:'demo-1',client_id:'sample-client',share_revision:1,pipeline_status:'submitted',shared_at:'2026-11-16T08:15:00Z',snapshot:{full_name:'מועמד א — דוגמה בלבד',job_title:'מנהל/ת מחלקה',headline:'ניסיון בניהול צוות ובתפעול שוטף',city:'נתניה',skills:'ניהול צוות, שירות לקוחות, עבודה בצוות',summary:'פרופיל פיקטיבי להמחשת המסך בלבד. מתאים להצגת ניסיון ניהולי, שירות ויכולת עבודה בסביבה תפעולית. אין כאן מידע על אדם אמיתי.',document_id:'synthetic-cv'},feedback:[]},
 {id:'demo-2',client_id:'sample-client',share_revision:1,pipeline_status:'submitted',shared_at:'2026-11-15T12:30:00Z',snapshot:{full_name:'מועמדת ב — דוגמה בלבד',job_title:'נציג/ת שירות',headline:'ניסיון בשירות לקוחות ובעבודה עם קהל',city:'פתח תקווה',skills:'שירות לקוחות, תקשורת בין אישית, עבודה במשמרות',summary:'פרופיל פיקטיבי להמחשת קריאת סיכום והתייחסות למועמדת. אין כאן נתונים של מועמדת אמיתית.',document_id:null},feedback:[]},
 {id:'demo-3',client_id:'sample-client',share_revision:1,pipeline_status:'submitted',shared_at:'2026-11-15T09:00:00Z',snapshot:{full_name:'מועמד ג — דוגמה בלבד',job_title:'מנהל/ת מחלקה',headline:'ניסיון בניהול מלאי ובתפעול',city:'ראשון לציון',skills:'ניהול מלאי, תפעול, סדר וארגון',summary:'סיכום פיקטיבי להמחשת מראה רשימת ההפניות בלבד.',document_id:null},feedback:[]}
]};

export default function ReviewClient({screen}:{screen?:string}){
 const [lang,L]=useState<PortalLanguage>('he'),[data,D]=useState<InboxData>(screen==='empty'?{...base,presentations:[]}:base),[revision,R]=useState(0),[view,V]=useState<WorkspaceView>(['account','security','preferences'].includes(screen??'')?'account':screen==='help'?'help':'inbox');
 const login=screen==='login'||screen==='expired';
 const reset=()=>{D(base);R(n=>n+1)};
 return <WorkspaceShell lang={lang} onLanguage={()=>L(lang==='he'?'en':'he')} view={view} onNavigate={login?undefined:V} name={login?undefined:lang==='he'?'נציג לדוגמה':'Demo representative'} client="חצי חינם · הדגמה" agency="תעסוקה טובה" count={data.presentations.length} review onReset={reset}>
 <HelpDrawer lang={lang} context={{audience:'client'}} onLanguage={()=>L(lang==='he'?'en':'he')} onSignIn={()=>{}} onNavigate={v=>V(v==='account-profile'?'account':'inbox')}/>
 {login?<section className="cpAuth"><div className="cpAuthIntro"><span className="cpAuthMark">↗</span><p>{lang==='he'?'פורטל לקוחות · hr-ai.tech':'hr-ai.tech · Client workspace'}</p><h1>{lang==='he'?'המועמד הבא שלך.\nבמקום אחד ברור.':'Your next candidate.\nOne clear workspace.'}</h1><div><span>01</span><p>{lang==='he'?'רואים את המועמדים שהופנו אליך':'See candidates referred to you'}</p></div><div><span>02</span><p>{lang==='he'?'קוראים סיכום מקצועי וקורות חיים':'Review a professional summary and CV'}</p></div><div><span>03</span><p>{lang==='he'?'משאירים תשובה ומתקדמים':'Respond and take the next step'}</p></div></div><EmailSignIn lang={lang} expired={screen==='expired'} onRequest={async()=>{}}/></section>
 :view==='account'?<div className="cpAccountPage"><AccountProfile key={screen} preview initialTab={screen==='security'?'security':screen==='preferences'?'preferences':'personal'} userId="demo-client" email="review@example.invalid" name={lang==='he'?'נציג לדוגמה':'Demo representative'} role="client" clientName="חצי חינם · הדגמה" admin={false} org={null} lang={lang} onLanguage={L} onSaved={async()=>{}} onBack={()=>V('inbox')}/></div>
 :view==='help'?<WorkspaceHelp lang={lang} onAccount={()=>V('account')} onSupport={()=>window.dispatchEvent(new Event('hh-open-help'))}/>
 :<ClientInbox key={revision} initialReferral={screen==='candidate'?'demo-1':undefined} data={data} lang={lang} onUpdate={async v=>{D(d=>({...d,presentations:d.presentations.map(p=>p.id===v.presentation?{...p,status_updates:[{id:v.request_id,status_code:v.status_code,label:({follow_up:'יחזור אם יתאים לו',unreachable:'אינו זמין בטלפון',known:'מועמד מוכר',second_choice:'עדיפות שניה',employed:'עובד/ת'} as Record<string,string>)[v.status_code],note:v.update_note,created_at:new Date().toISOString()},...(p.status_updates??[])]}:p)}))}} onRefresh={()=>D(d=>({...d}))} onDocument={async()=>{const sample=await fetch('/review/client-inbox/sample-cv');if(!sample.ok)throw Error('SAMPLE_UNAVAILABLE');return {file:await sample.blob(),label:lang==='he'?'קורות חיים — הדגמה בלבד':'CV — demonstration only'};}} onRespond={async v=>{D(d=>({...d,presentations:d.presentations.filter(p=>p.id!==v.presentation)}))}}/>}
 </WorkspaceShell>;
}
