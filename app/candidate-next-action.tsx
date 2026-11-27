'use client';

import {useEffect,useState} from 'react';
import {db} from '../lib/supabase';
import type {HiringTarget} from '../lib/recruitment-context';
import {statusText,type Job} from './models';

type Placement={id:string;job_id:string;status:string};

export default function CandidateNextAction({org,candidate,jobs,lang,onOpen}:{
  org:string;candidate:string;jobs:Job[];lang:'he'|'en';onOpen:(target:HiringTarget)=>void;
}){
  const t=(he:string,en:string)=>lang==='he'?he:en;
  const [rows,setRows]=useState<Placement[]|null>(null),[failed,setFailed]=useState(false);
  useEffect(()=>{
    if(!db)return;
    const abort=new AbortController();
    void db.from('candidate_placements').select('id,job_id,status').eq('organization_id',org).eq('candidate_id',candidate)
      .in('status',['submitted','reviewing','interview','offer']).order('created_at',{ascending:false}).limit(5)
      .abortSignal(abort.signal).then(({data,error})=>{
        if(abort.signal.aborted)return;
        if(error)setFailed(true);else setRows(data??[]);
      });
    return()=>abort.abort();
  },[org,candidate]);
  if(failed)return <p role="status">{t('לא ניתן היה לטעון את השיוכים הפעילים.','Unable to load active assignments.')}</p>;
  if(!rows?.length)return null;
  return <section className="workflowCandidateAssignments" aria-label={t('שיוכים פעילים','Active assignments')}>
    <b>{t('שיוכים פעילים','Active assignments')}</b>
    {rows.map(row=>{
      const job=jobs.find(job=>job.id===row.job_id);
      if(!job)return null;
      return <div className="workflowNext" key={row.id}>
        <strong dir="auto">{job.title}</strong>
        <span className="badge workflowStatus" data-stage={row.status}>{statusText[row.status]?.[lang==='he'?0:1]}</span>
        <button type="button" onClick={()=>onOpen({jobId:row.job_id,recordId:row.id,manual:true})}>{t('פתיחת התהליך במשרה','Open in recruitment process')}</button>
      </div>;
    })}
  </section>;
}
