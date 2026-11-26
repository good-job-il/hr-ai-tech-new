'use client';
import {useRef,useState} from 'react';
import {db} from '../lib/supabase';
import {addPipelinePlacement,placementError} from '../lib/pipeline-placement';
import type {HiringTarget} from '../lib/recruitment-context';
import type {OrganizationJob} from './models';
import './recruitment-work.css';

export default function CandidateJobAssignment({orgId,userId,candidateId,jobs,agency,lang,onOpen,initiallyOpen=false}:{
  orgId:string; userId:string; candidateId:string; jobs:OrganizationJob[]; agency:boolean; lang:'he'|'en';
  onOpen:(target:HiringTarget)=>void; initiallyOpen?:boolean;
}) {
  const t=(he:string,en:string)=>lang==='he'?he:en;
  const [show,setShow]=useState(initiallyOpen),[jobId,setJobId]=useState(''),[request,setRequest]=useState(false);
  const [saved,setSaved]=useState<HiringTarget|null>(null),[busy,setBusy]=useState(false);
  const [message,setMessage]=useState(''),[error,setError]=useState('');
  const submitting=useRef(false);
  const openJobs=jobs.filter(job=>job.organization_id===orgId&&job.status==='open');
  const job=openJobs.find(job=>job.id===jobId);

  async function save(){
    if(submitting.current||(!saved&&!job))return;
    submitting.current=true;setBusy(true);setError('');
    try {
      let target=saved;
      if(!target){
        const result=await addPipelinePlacement(orgId,userId,candidateId,jobId,'manual');
        if(result.error){setError(placementError(result.error.code,lang==='he'));return;}
        target={jobId,recordId:result.data.id,manual:true};
        setSaved(target);
        setMessage(t('המועמד שויך למשרה.','Candidate assigned to the job.'));
      }
      if(request&&agency&&job?.client_id){
        const result=await db!.rpc('request_candidate_submission',{placement:target.recordId});
        if(result.error){setError(t('השיוך נשמר, אך בקשת האישור לא נקלטה.','The assignment was saved, but approval could not be requested.'));return;}
        setMessage(t('השיוך ובקשת האישור נרשמו.','The assignment and approval request were recorded.'));
      }
      setRequest(false);
      setShow(false);
    } catch {
      setError(t('הפעולה לא הושלמה. אפשר לנסות שוב.','The operation could not be completed. Please retry.'));
    } finally {submitting.current=false;setBusy(false);}
  }

  return <div className="candidateJobAssignment">
    {!saved&&!show&&<button type="button" className="gradientButton" onClick={()=>setShow(true)}>{t('שיוך למשרה','Assign to job')}</button>}
    {saved&&<><button type="button" onClick={()=>onOpen(saved)}>{t('פתיחת המועמד במשרה','Open candidate in job')}</button>{!show&&<button type="button" onClick={()=>{setSaved(null);setJobId('');setMessage('');setShow(true);}}>{t('שיוך למשרה נוספת','Assign to another job')}</button>}</>}
    {show&&<form className="detailPanel orgInlineForm" onSubmit={event=>{event.preventDefault();void save();}}>
      <label>{t('משרה פתוחה','Open job')}<select required autoFocus value={jobId} disabled={busy||!!saved} onChange={event=>{setJobId(event.target.value);setRequest(false);}}>
        <option value="">{t('בחר משרה','Choose a job')}</option>
        {openJobs.map(item=><option key={item.id} value={item.id}>{item.title}{item.location?' · '+item.location:''}</option>)}
      </select></label>
      {!openJobs.length&&<p>{t('אין משרות פתוחות זמינות לשיוך.','No open jobs are available for assignment.')}</p>}
      {agency&&job?.client_id&&<label className="taskRow"><input type="checkbox" checked={request} disabled={busy} onChange={event=>setRequest(event.target.checked)}/>{t('לבקש גם אישור להפניה','Also request submission approval')}</label>}
      <button disabled={busy||!job||!!saved&&!request}>{saved?t('ניסיון נוסף לבקשת אישור','Retry approval request'):t('שמירת שיוך','Save assignment')}</button>
      <button type="button" disabled={busy} onClick={()=>{setShow(false);setRequest(false);setError('');}}>{t('סגירה','Close')}</button>
    </form>}
    {message&&<p role="status">{message}</p>}
    {error&&<p role="alert">{error}</p>}
  </div>;
}
