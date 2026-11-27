'use client';

import {useEffect,useRef,useState} from 'react';
import {validateJob} from '../lib/domain.mjs';
import type {Job} from './models';
import {JobClientSelect} from './organization-operations';

const draftKeys=['client','title','location','description','responsibilities','requirements','benefits','category','work_mode','experience','salary_min','salary_max','is_public','type'] as const;
type Draft=Partial<Record<typeof draftKeys[number],string>>;
function readJob(form:HTMLFormElement,fallbackClient?:string|null){
  const fields=new FormData(form);
  const text=(name:string)=>String(fields.get(name)??'').trim();
  const number=(name:string)=>text(name)?Number(text(name)):null;
  return {client_id:fields.has('client')?text('client')||null:fallbackClient??null,title:text('title'),location:text('location'),description:text('description'),
    responsibilities:text('responsibilities'),requirements:text('requirements'),benefits:text('benefits'),category:text('category'),
    work_mode:text('work_mode'),experience_years:number('experience'),salary_min:number('salary_min'),salary_max:number('salary_max'),
    is_public:fields.has('is_public'),type:text('type')};
}
export type JobEditorValues=ReturnType<typeof readJob>;

export default function JobEditor({org,userId,lang,editing,busy,onSave}:{
  org:{id:string;kind:string};userId:string;lang:'he'|'en';editing:Job|null;busy:boolean;onSave:(job:JobEditorValues)=>Promise<boolean>;
}){
  const t=(he:string,en:string)=>lang==='he'?he:en;
  const key='hr-ai.job-draft.'+userId+'.'+org.id;
  const form=useRef<HTMLFormElement>(null);
  const optional=useRef<HTMLDetailsElement>(null);
  const reviewHeading=useRef<HTMLHeadingElement>(null);
  const [draft,setDraft]=useState<Draft|null>(null);
  const [preview,setPreview]=useState<JobEditorValues|null>(null);
  const [notice,setNotice]=useState('');
  useEffect(()=>{
    let restored:Draft={};
    if(!editing)try{
      const saved=JSON.parse(localStorage.getItem(key)??'null');
      if(saved&&typeof saved==='object'){
        for(const field of draftKeys)if(typeof saved[field]==='string')restored[field]=saved[field];
      }
    }catch{}
    setDraft(restored);
  },[editing,key]);
  useEffect(()=>{if(preview)reviewHeading.current?.focus()},[preview]);

  function saveDraft(){
    if(!form.current)return;
    const values=new FormData(form.current);
    const snapshot=Object.fromEntries(draftKeys.map(name=>[name,String(values.get(name)??'')]));
    try{
      localStorage.setItem(key,JSON.stringify(snapshot));
      setNotice(t('הטיוטה נשמרה בדפדפן הזה.','Draft saved in this browser.'));
    }catch{setNotice(t('הטיוטה לא נשמרה. אפשר לנסות שוב.','The draft could not be saved. Please try again.'))}
  }

  function review(){
    if(!form.current)return;
    if(!form.current.checkValidity()&&optional.current)optional.current.open=true;
    if(!form.current.reportValidity())return;
    const job=readJob(form.current,editing?.client_id??draft?.client);
    if(validateJob(job)){
      setNotice(t('יש למלא שם תפקיד, מיקום ותיאור תקינים.','Enter a valid job title, location and description.'));return;
    }
    if(job.salary_min!=null&&job.salary_max!=null&&job.salary_min>job.salary_max){
      setNotice(t('שכר המינימום צריך להיות קטן או שווה לשכר המקסימום.','Minimum salary must not exceed maximum salary.'));return;
    }
    setNotice('');setPreview(job);
  }

  if(!draft)return <p role="status">{t('טוען את פרטי המשרה…','Loading job details…')}</p>;
  const typeLabels:Record<string,string>={'full-time':t('משרה מלאה','Full-time'),'part-time':t('משרה חלקית','Part-time'),contract:t('חוזה','Contract'),unspecified:t('היקף לא נמסר','Not specified')};
  const modeLabels:Record<string,string>={onsite:t('במשרד','Onsite'),hybrid:t('היברידי','Hybrid'),remote:t('מרחוק','Remote')};
  const sections=[['responsibilities',t('תחומי אחריות','Responsibilities')],['requirements',t('דרישות התפקיד','Requirements')],['benefits',t('תנאים והטבות','Benefits')]] as const;
  return <form className="jobEditor" ref={form} noValidate onSubmit={async e=>{
    e.preventDefault();
    if(!preview){review();return}
    if(busy)return;
    if(await onSave(preview)&&!editing)try{localStorage.removeItem(key)}catch{}
  }}>
    <div hidden={!!preview}>
      <h2>{editing?t('עריכת משרה','Edit job'):t('משרה חדשה','New job')}</h2>
      <fieldset><legend>{t('פרטי חובה','Required details')}</legend>
        <label>{t('שם התפקיד','Job title')}<input name="title" defaultValue={editing?.title??draft.title} required maxLength={120}/></label>
        <label>{t('מיקום','Location')}<input name="location" defaultValue={editing?.location??draft.location} required maxLength={120}/></label>
        <label>{t('תיאור התפקיד','Job description')}<textarea name="description" defaultValue={editing?.description??draft.description} required maxLength={12000}/></label>
      </fieldset>
      <details ref={optional} open={editing?true:undefined}><summary>{t('פרטים נוספים','Additional details')}</summary>
        {org.kind==='agency'&&<JobClientSelect org={org.id} lang={lang} value={editing?.client_id??draft.client}/>}
        <label>{t('היקף משרה','Employment type')}<select name="type" defaultValue={editing?.type??(draft.type||'full-time')}>{Object.entries(typeLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
        <label>{t('אופן העבודה','Work arrangement')}<select name="work_mode" defaultValue={editing?.work_mode??(draft.work_mode||'onsite')}>{Object.entries(modeLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
        <label>{t('תחום','Field')}<input name="category" defaultValue={editing?.category??draft.category} maxLength={120}/></label>
        {sections.map(([name,label])=><label key={name}>{label}<textarea name={name} defaultValue={editing?.[name]??draft[name]} maxLength={name==='benefits'?8000:12000}/></label>)}
        <label>{t('שנות ניסיון','Years of experience')}<input type="number" name="experience" min="0" max="60" defaultValue={editing?.experience_years??draft.experience}/></label>
        <label>{t('שכר חודשי בש״ח — מינימום','Monthly salary in ILS — minimum')}<input type="number" name="salary_min" min="0" defaultValue={editing?.salary_min??draft.salary_min}/></label>
        <label>{t('שכר חודשי בש״ח — מקסימום','Monthly salary in ILS — maximum')}<input type="number" name="salary_max" min="0" defaultValue={editing?.salary_max??draft.salary_max}/></label>
      </details>
      <label className="taskRow"><input type="checkbox" name="is_public" defaultChecked={editing?.is_public??(draft.is_public===undefined||draft.is_public==='on')}/>{t('הצגת המשרה באתר הציבורי','Show on the public job site')}</label>
      <div className="workflowActions">
        <button type="button" className="gradientButton" onClick={review}>{t('תצוגה מקדימה','Preview')}</button>
        {!editing&&<button type="button" onClick={saveDraft}>{t('שמירת טיוטה','Save draft')}</button>}
      </div>
    </div>
    {preview&&<section className="jobEditorPreview">
      <h2 ref={reviewHeading} tabIndex={-1}>{t('תצוגה מקדימה','Preview')}</h2>
      <span className="badge">{preview.is_public?t('משרה ציבורית','Public job'):t('משרה פנימית','Internal job')}</span>
      <h3 dir="auto">{preview.title}</h3>
      <p><bdi>{preview.location}</bdi> · {typeLabels[preview.type]} · {modeLabels[preview.work_mode]}</p>
      <p className="prewrap" dir="auto">{preview.description}</p>
      {preview.category&&<p><bdi>{preview.category}</bdi></p>}
      {preview.experience_years!=null&&<p>{t('שנות ניסיון','Years of experience')} · {preview.experience_years}</p>}
      {(preview.salary_min!=null||preview.salary_max!=null)&&<p>{t('שכר חודשי בש״ח','Monthly salary in ILS')} · <bdi>{preview.salary_min?.toLocaleString()??'–'} – {preview.salary_max?.toLocaleString()??'–'}</bdi></p>}
      {sections.map(([name,label])=>preview[name]&&<section key={name}><h4>{label}</h4><p className="prewrap" dir="auto">{preview[name]}</p></section>)}
      <div className="workflowActions"><button type="button" disabled={busy} onClick={()=>setPreview(null)}>{t('חזרה לעריכה','Back to editing')}</button>
        <button type="submit" className="gradientButton" disabled={busy}>{busy?t('שומר…','Saving…'):editing?t('שמירת שינויים','Save changes'):preview.is_public?t('פרסום באתר','Publish on the job site'):t('יצירת משרה פנימית','Create internal job')}</button></div>
    </section>}
    {notice&&<p role="status">{notice}</p>}
  </form>;
}
