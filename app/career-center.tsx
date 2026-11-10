'use client';
import {useEffect,useRef,useState} from 'react';
import {db} from '../lib/supabase';
import type {CareerResult,CareerTask} from '../lib/career-provider';
import UiIcon from './ui-icon';
import './career-center.css';

export default function CareerCenter({lang,onAuth}:{lang:'he'|'en';onAuth?:()=>void}){
 const he=lang==='he',tr=(h:string,e:string)=>he?h:e;
 const [available,setAvailable]=useState<boolean|null>(null),[signedIn,setSignedIn]=useState(false);
 const [task,setTask]=useState<CareerTask>('cv-improvement'),[profileText,setProfile]=useState(''),[jobText,setJob]=useState(''),[consent,setConsent]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<CareerResult|null>(null);
 const pending=useRef<AbortController|null>(null);
 useEffect(()=>{
  const controller=new AbortController();
  fetch('/api/career',{signal:controller.signal}).then(r=>r.ok?r.json():Promise.reject()).then(r=>setAvailable(r.available===true)).catch(()=>{if(!controller.signal.aborted)setAvailable(false)});
  db?.auth.getSession().then(({data})=>setSignedIn(!!data.session));
  const sub=db?.auth.onAuthStateChange((_event,session)=>{pending.current?.abort();setBusy(false);setSignedIn(!!session);setResult(null);setConsent(false);if(!session){setProfile('');setJob('')}});
  return()=>{controller.abort();pending.current?.abort();sub?.data.subscription.unsubscribe()};
 },[]);
 useEffect(()=>{pending.current?.abort();setBusy(false);setResult(null);setError('');setConsent(false)},[task,profileText,jobText,lang]);
 const tools:[CareerTask,string,string,string][]=[['cv-improvement','mine','שדרוג קורות חיים','CV improvement'],['job-matching','search','התאמת משרות','Job matching'],['interview-preparation','support','הכנה לראיון','Interview preparation'],['career-insights','chart','תובנות קריירה','Career insights']];
 const needsJob=task==='job-matching'||task==='interview-preparation';
 async function submit(event:React.FormEvent){
  event.preventDefault();if(busy||!consent||!available)return;
  setBusy(true);setError('');setResult(null);const controller=new AbortController();pending.current=controller;
  try{
   const {data}=await db!.auth.getSession();if(!data.session){setSignedIn(false);throw new Error('NOT_AUTHENTICATED')}
   const response=await fetch('/api/career',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({task,language:lang,profileText,jobText:needsJob?jobText:'',consent}),signal:controller.signal});
   const body=await response.json();if(!response.ok)throw new Error(body.error||'AI_UNAVAILABLE');
   if(!controller.signal.aborted)setResult(body.result);
  }catch(cause){if(!controller.signal.aborted){const code=cause instanceof Error?cause.message:'';setError(code==='AI_QUOTA_REACHED'?tr('מכסת ה-AI הזמינה מוצתה או שהתקבלה מגבלת קצב. לא נרכשו קרדיטים נוספים. אפשר לנסות שוב מאוחר יותר.','The available AI quota or rate limit was reached. No additional credits were purchased. Try again later.'):code==='NOT_AUTHENTICATED'?tr('יש להתחבר מחדש לפני השימוש.','Please sign in again before continuing.'):code==='AI_NOT_CONFIGURED'?tr('כלי ה-AI אינם זמינים כרגע. אפשר לחזור מאוחר יותר.','AI tools are currently unavailable. Please return later.'):tr('לא התקבלה תשובה מלאה. אפשר לנסות שוב.','A complete response could not be received. Please try again.'))}}
  finally{if(pending.current===controller){setBusy(false);pending.current=null}}
 }
 return <section className="careerCenter" dir={he?'rtl':'ltr'}>
  <span className="eyebrow">{tr('כלים לקריירה','CAREER TOOLS')}</span><h1>{tr('מרכז הקריירה שלך','Your career center')}</h1>
  <p className="careerLead">{tr('הצעות אישיות לשדרוג קורות החיים, להכנה לראיון ולצעד הבא בקריירה.','Personal guidance for your CV, interview preparation and next career step.')}</p>
  <div className="careerChoices" aria-label={tr('בחירת כלי','Choose a tool')}>{tools.map(([id,icon,h,e])=><button type="button" key={id} aria-pressed={task===id} onClick={()=>setTask(id)}><UiIcon name={icon}/><span>{tr(h,e)}</span></button>)}</div>
  {available===null?<p role="status">{tr('בודקים זמינות...','Checking availability…')}</p>:!available?<p className="careerNotice" role="status">{tr('כלי ה-AI אינם זמינים כרגע. תוכן לא יישלח לספק.','AI tools are currently unavailable. No content will be sent to the provider.')}</p>:null}
  {!signedIn&&<div className="careerNotice"><p>{tr('יש להתחבר כדי להשתמש בכלי ה-AI.','Sign in to use the AI tools.')}</p>{onAuth&&<button type="button" className="gradientButton" onClick={onAuth}>{tr('התחברות','Sign in')}</button>}</div>}
  <form className="careerForm detailPanel" onSubmit={submit}>
   <h2>{tools.find(t=>t[0]===task)?.[he?2:3]}</h2>
   <label htmlFor="career-profile">{tr('הניסיון, הכישורים והמטרות שלך','Your experience, skills and goals')}</label>
   <p id="career-profile-help" className="careerHelp">{tr('הדבק טקסט מקצועי בלבד, ללא טלפון, אימייל, מספר זהות או מידע רגיש. לא נטען מידע מהמאגר באופן אוטומטי.','Paste professional information only, without phone numbers, email addresses, ID numbers or sensitive information. No database content is loaded automatically.')}</p>
   <textarea id="career-profile" aria-describedby="career-profile-help" dir="auto" required minLength={20} maxLength={16000} rows={8} value={profileText} onChange={e=>setProfile(e.target.value)} placeholder={tr('ניסיון מקצועי, כישורים ותפקיד שמעניין אותך...','Your experience, skills and a role that interests you…')}/>
   {needsJob&&<><label htmlFor="career-job">{tr('תיאור המשרה והדרישות','Job description and requirements')}</label><textarea id="career-job" dir="auto" required minLength={20} maxLength={8000} rows={5} value={jobText} onChange={e=>setJob(e.target.value)}/></>}
   <label className="careerConsent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>{tr('אני מאשר לשלוח את הטקסט שהזנתי ל-OpenAI לצורך הפקת ההצעות. אני רשאי לשתף אותו. ההצעות נוצרות באמצעות AI ודורשות בדיקה.','I consent to sending the text I entered to OpenAI to generate guidance and have permission to share it. AI-generated suggestions require review.')}</span></label>
   <p className="careerHelp">{tr('נשלח רק הטקסט שבטופס. הוא לא נשמר בהיסטוריית האתר. OpenAI אינו משתמש בנתוני API לאימון כברירת מחדל; תיתכן שמירה מוגבלת לצורכי בטיחות.','Only the text in this form is sent. It is not saved in site history. OpenAI does not use API data for training by default; limited safety retention may apply.')}</p>
   <button className="gradientButton" type="submit" disabled={!signedIn||!available||!consent||busy}>{busy?tr('מכינים הצעות...','Preparing guidance…'):tr('קבלת הצעות עם AI','Get AI guidance')}</button>
   {error&&<p className="careerNotice" role="alert">{error}</p>}
  </form>
  {result&&<section className="careerResult detailPanel" aria-live="polite"><span className="eyebrow">{tr('הצעות שנוצרו באמצעות AI','AI-GENERATED GUIDANCE')}</span><h2>{tr('ההצעות שלך','Your guidance')}</h2><p dir="auto">{result.summary}</p><ol>{result.suggestions.map((text,i)=><li dir="auto" key={i}>{text}</li>)}</ol>{result.limitations.length>0&&<><h3>{tr('מה חשוב לקחת בחשבון','Keep in mind')}</h3><ul>{result.limitations.map((text,i)=><li dir="auto" key={i}>{text}</li>)}</ul></>}</section>}
 </section>;
}
