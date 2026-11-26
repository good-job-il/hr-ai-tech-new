'use client';

import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import type {Application,Job,OrganizationJob} from './models';
import type {HiringTarget,RecruitmentListMemory} from '../lib/recruitment-context';
import {useListScroll} from '../lib/use-list-scroll';
import RecruitmentBoard from './recruitment-board';
import OrganizationReports from './organization-reports';
import UiIcon from './ui-icon';
import './organization-workspace-design.css';

export default function OrganizationJobs({jobs,apps,orgId,userId,role,lang,onRefresh,onAdd,onEdit,initialJob='',target,memory,onReturn}:{
  jobs:OrganizationJob[];apps:Application[];orgId:string;userId:string;role:string;lang:'he'|'en';
  onRefresh:()=>Promise<void>;onAdd?:()=>void;onEdit?:(job:Job)=>void;initialJob?:string;
  target?:HiringTarget;memory:RecruitmentListMemory;onReturn?:()=>void;
}) {
  const t=(he:string,en:string)=>lang==='he'?he:en;
  const [selected,setSelected]=useState(target?.jobId||(memory.jobs?memory.jobs.selected:initialJob));
  const [query,setQuery]=useState(memory.jobs?.query??''),[status,setStatus]=useState(memory.jobs?.status??'all');
  const [visibility,setVisibility]=useState(memory.jobs?.visibility??'all');
  const [tab,setTab]=useState(target?'candidates':memory.jobs?.tab??'candidates');
  const [activeTarget,setActiveTarget]=useState(target);
  const restoreFocus=useRef('');
  const heading=useRef<HTMLHeadingElement>(null);
  const list=useListScroll<HTMLElement>(memory.jobScroll,!selected&&jobs.length>0,'y');

  useEffect(()=>{
    if(target){
      setActiveTarget(target);
      setSelected(target.jobId);
      setTab('candidates');
    }
  },[target]);
  useEffect(()=>{memory.jobs={query,status,visibility,selected,tab};},[memory,query,status,visibility,selected,tab]);

  useLayoutEffect(()=>{
    if(selected){
      window.scrollTo({top:0,behavior:'instant'});
      heading.current?.focus({preventScroll:true});
    }else if(restoreFocus.current){
      list.current?.querySelector<HTMLButtonElement>('[data-job-row="'+CSS.escape(restoreFocus.current)+'"]')?.focus({preventScroll:true});
      restoreFocus.current='';
    }
  },[selected,list]);

  const filtered=useMemo(()=>{
    const term=query.trim().toLocaleLowerCase();
    return jobs.filter(job=>
      (status==='all'||(job.status==='closed'?'closed':'open')===status)&&
      (visibility==='all'||(job.is_public===false?'internal':'public')===visibility)&&
      (job.title+' '+job.location).toLocaleLowerCase().includes(term)
    );
  },[jobs,query,status,visibility]);
  const job=jobs.find(job=>job.id===selected);
  const jobApps=job?apps.filter(entry=>entry.job?.id===job.id):[];
  const statusLabel=(item:OrganizationJob)=>item.status==='closed'?t('סגורה','Closed'):t('פתוחה','Open');

  function openJob(id:string) {
    memory.jobScroll.page=window.scrollY;
    setActiveTarget(undefined);
    setTab('candidates');
    setSelected(id);
  }

  function backToList() {
    restoreFocus.current=selected;
    setActiveTarget(undefined);
    setSelected('');
  }

  return <section className="orgJobs organizationJobWorkspace">
    {!selected?<section className="organizationJobIndex" ref={list}>
      <div className="orgPageHeading">
        <div><h1>{t('משרות ותהליכים','Jobs & processes')}</h1></div>
        {onAdd&&<button className="gradientButton" onClick={onAdd}><UiIcon name="plus" size={18}/>{t('פרסום משרה','Publish a job')}</button>}
      </div>
      <div className="organizationJobFilters">
        <label>{t('חיפוש משרה','Find job')}<input value={query} placeholder={t('שם המשרה או מיקום','Job title or location')} onChange={e=>setQuery(e.target.value)}/></label>
        <label>{t('סטטוס','Status')}<select value={status} onChange={e=>setStatus(e.target.value)}>
          <option value="all">{t('כל הסטטוסים','All statuses')}</option><option value="open">{t('פתוחות','Open')}</option><option value="closed">{t('סגורות','Closed')}</option>
        </select></label>
        <label>{t('תצוגה באתר','Visibility')}<select value={visibility} onChange={e=>setVisibility(e.target.value)}>
          <option value="all">{t('כל המשרות','All jobs')}</option><option value="public">{t('ציבוריות','Public')}</option><option value="internal">{t('פנימיות','Internal')}</option>
        </select></label>
        <button type="button" disabled={!query&&status==='all'&&visibility==='all'} onClick={()=>{setQuery('');setStatus('all');setVisibility('all');}}>{t('ניקוי סינון','Clear filters')}</button>
      </div>
      <ul className="organizationJobRows" aria-label={t('רשימת משרות','Job list')}>
        {filtered.map(item=><li key={item.id}>
          <button type="button" data-job-row={item.id} onClick={()=>openJob(item.id)}>
            <span className="organizationJobRowIcon"><UiIcon name="jobs" size={22}/></span>
            <span className="organizationJobRowText"><strong dir="auto">{item.title}</strong>{item.location&&<small dir="auto">{item.location}</small>}</span>
            <span className="organizationJobRowMeta">
              <span className="badge" data-job-status={item.status==='closed'?'closed':'open'}>{statusLabel(item)}</span>
              {item.is_public===false&&<span className="badge">{t('פנימית','Internal')}</span>}
            </span>
            <span className="organizationJobRowArrow"><UiIcon name="arrow-forward" size={20}/></span>
          </button>
        </li>)}
      </ul>
      {!filtered.length&&<p className="organizationJobEmpty">{jobs.length?t('אין משרות שמתאימות לסינון.','No jobs match these filters.'):t('אין משרות להצגה.','No jobs to display.')}</p>}
    </section>:<div className="orgJobMain organizationJobDetail">
      <div className="organizationJobBack">
        <button type="button" onClick={backToList}><UiIcon name="arrow-forward" size={18}/>{t('חזרה לרשימת המשרות','Back to job list')}</button>
        {onReturn&&<button type="button" onClick={onReturn}>{t('חזרה למאגר המועמדים','Back to candidate list')}</button>}
      </div>
      {job?<div className="organizationJobCard">
        <header className="organizationJobHeader">
          <span className="organizationJobRowIcon"><UiIcon name="jobs" size={26}/></span>
          <div><h1 ref={heading} tabIndex={-1} dir="auto">{job.title}</h1><div className="organizationJobHeaderMeta">
            {job.location&&<span dir="auto">{job.location}</span>}<span className="badge" data-job-status={job.status==='closed'?'closed':'open'}>{statusLabel(job)}</span>
            {job.is_public===false&&<span className="badge">{t('פנימית','Internal')}</span>}
          </div></div>
          {onEdit&&<button onClick={()=>onEdit(job)}>{t('עריכת משרה','Edit job')}</button>}
        </header>
        <div className="orgViewTabs organizationJobTabs">
          {[['candidates',t('מועמדים למשרה','Applicants')],['details',t('פרטי משרה','Job details')],['activity',t('דוח המשרה','Job report')]].map(([key,label])=>
            <button key={key} type="button" aria-pressed={tab===key} onClick={()=>setTab(key)}>{label}</button>)}
        </div>
        <div className="organizationJobBody">
          {tab==='details'?<section className="detailPanel"><h3>{t('תיאור המשרה','Job description')}</h3><p className="prewrap" dir="auto">{job.description}</p>
            {job.requirements&&<><h3>{t('דרישות','Requirements')}</h3><p className="prewrap" dir="auto">{job.requirements}</p></>}</section>
          :tab==='activity'?<OrganizationReports key={job.id} initialJob={job.id} org={{id:orgId,name:''}} jobs={[job]} apps={jobApps} lang={lang}/>
          :<RecruitmentBoard key={job.id} compact initialJob={job.id} target={activeTarget?.jobId===job.id?activeTarget:undefined} memory={memory.boards}
            jobs={[job]} apps={jobApps} orgId={orgId} userId={userId} role={role} lang={lang} onRefresh={onRefresh}/>}
        </div>
      </div>:<p className="organizationJobEmpty" role="status">{jobs.length?t('המשרה אינה זמינה בסביבת עבודה זו.','This job is unavailable in this workspace.'):t('אין משרה זמינה להצגה.','No job is available to display.')}</p>}
    </div>}
  </section>;
}
