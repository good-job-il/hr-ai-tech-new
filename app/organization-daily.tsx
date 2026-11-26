'use client';
import {useEffect,useState} from 'react';
import {db} from '../lib/supabase';
import {useCapabilities} from '../lib/workspace-permissions';
import type {HiringTarget} from '../lib/recruitment-context';
import type {Application} from './models';
import UiIcon from './ui-icon';
import './recruitment-work.css';

type Task={id:string;title:string;due_date:string|null};
type Interview={id:string;starts_at:string;notes:string;target:HiringTarget};
type QueueEvent={kind:'approval'|'client_feedback';event_id:string;job_id:string;record_id:string;job_title:string;candidate_name:string;occurred_at:string};
type WorkView='tasks'|'interviews'|'applications'|QueueEvent['kind'];

export default function OrganizationDaily({org,userId,lang,applications,onNavigate,interviewsOnly=false}:{
  org:{id:string;name:string;kind?:string}; userId:string; lang:'he'|'en'; applications:Application[];
  onNavigate:(view:string,target?:HiringTarget)=>void; interviewsOnly?:boolean;
}) {
  const t=(he:string,en:string)=>lang==='he'?he:en;
  const cap=useCapabilities(org.id),agency=org.kind==='agency';
  const [tasks,setTasks]=useState<Task[]>([]),[interviews,setInterviews]=useState<Interview[]>([]);
  const [events,setEvents]=useState<QueueEvent[]>([]),[taskCount,setTaskCount]=useState<number|null>(null);
  const [tab,setTab]=useState<WorkView>(interviewsOnly?'interviews':agency?'approval':'applications');
  const [show,setShow]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true),[queueError,setQueueError]=useState(false);
  const [reload,setReload]=useState(0);
  const [applicantNames,setApplicantNames]=useState<Record<string,string>>({});
  const newApplications=applications.filter(a=>a.status==='submitted'&&a.job?.organization_id===org.id)
    .sort((a,b)=>a.created_at.localeCompare(b.created_at));
  const applicantIds=Array.from(new Set(newApplications.slice(0,20).map(item=>item.candidate_id))).join(',');
  const locale=lang==='he'?'he-IL':'en-GB';
  const dateTime=(value:string)=>new Date(value).toLocaleString(locale,{dateStyle:'short',timeStyle:'short'});
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Jerusalem',dateStyle:'short'}).format(new Date());

  useEffect(()=>{
    const abort=new AbortController(),signal=abort.signal,from=new Date().toISOString();
    setLoading(true);
    async function load(){
      const [taskResult,manual,web,queue]=await Promise.all([
        db!.from('recruitment_tasks').select('id,title,due_date',{count:'exact'}).eq('organization_id',org.id).eq('done',false)
          .order('due_date',{ascending:true,nullsFirst:false}).limit(50).abortSignal(signal),
        db!.from('placement_interviews').select('id,starts_at,notes,placement_id,placement:candidate_placements!inner(organization_id,job_id)')
          .eq('placement.organization_id',org.id).is('cancelled_at',null).gte('starts_at',from).order('starts_at').limit(10).abortSignal(signal),
        db!.from('interviews').select('id,starts_at,notes,application_id,application:applications!inner(job_id,job:jobs!inner(organization_id))')
          .eq('application.job.organization_id',org.id).is('cancelled_at',null).gte('starts_at',from).order('starts_at').limit(10).abortSignal(signal),
        agency&&!interviewsOnly?db!.rpc('recruitment_work_queue',{org:org.id}).abortSignal(signal):Promise.resolve({error:null,data:[]}),
      ]);
      if(signal.aborted)return;
      setLoading(false);
      setError(taskResult.error||manual.error||web.error?t('חלק מהנתונים לא נטענו.','Some work items could not be loaded.'):'');
      setQueueError(!!queue.error);
      if(!taskResult.error){setTasks(taskResult.data??[]);setTaskCount(taskResult.count??0);}
      const manualItems=(manual.data??[]) as unknown as {id:string;starts_at:string;notes:string;placement_id:string;placement:{job_id:string}}[];
      const webItems=(web.data??[]) as unknown as {id:string;starts_at:string;notes:string;application_id:string;application:{job_id:string}}[];
      setInterviews([
        ...manualItems.map(row=>({id:row.id,starts_at:row.starts_at,notes:row.notes,target:{jobId:row.placement.job_id,recordId:row.placement_id,manual:true}})),
        ...webItems.map(row=>({id:row.id,starts_at:row.starts_at,notes:row.notes,target:{jobId:row.application.job_id,recordId:row.application_id}})),
      ].sort((a,b)=>a.starts_at.localeCompare(b.starts_at)).slice(0,10));
      setEvents(queue.error?[]:queue.data as QueueEvent[]);
    }
    void load().catch(()=>{if(!signal.aborted){setLoading(false);setError(t('טעינת העבודה נכשלה.','Unable to load your work.'));}});
    return()=>abort.abort();
  },[org.id,agency,interviewsOnly,reload,lang]);

  useEffect(()=>{
    if(interviewsOnly||!applicantIds)return;
    const abort=new AbortController();
    void db!.from('candidate_profiles').select('user_id,full_name').in('user_id',applicantIds.split(',')).abortSignal(abort.signal).then(result=>{
      if(!abort.signal.aborted&&!result.error)setApplicantNames(Object.fromEntries(result.data.map(row=>[row.user_id,row.full_name])));
    });
    return()=>abort.abort();
  },[interviewsOnly,applicantIds]);

  async function update(run:()=>PromiseLike<{error:unknown}>){
    setError('');setBusy(true);
    try{
      const result=await run();
      if(result.error)setError(t('העדכון לא נשמר. אפשר לנסות שוב.','The update could not be saved. Please retry.'));
      else setReload(value=>value+1);
      return !result.error;
    } catch {
      setError(t('העדכון לא נשמר. אפשר לנסות שוב.','The update could not be saved. Please retry.'));
      return false;
    } finally {setBusy(false);}
  }

  const approvals=events.filter(item=>item.kind==='approval');
  const feedback=events.filter(item=>item.kind==='client_feedback');
  const tabs:{id:WorkView;label:string;icon:string;count?:number|null}[]=[
    {id:'tasks',label:t('משימות פתוחות','Open tasks'),icon:'tasks',count:taskCount},
    {id:'interviews',label:t('ראיונות קרובים','Upcoming interviews'),icon:'interviews'},
  ];
  if(!interviewsOnly){
    tabs.unshift({id:'applications',label:t('מועמדויות חדשות','New applications'),icon:'jobs',count:newApplications.length});
    if(agency){
      tabs.unshift({id:'client_feedback',label:t('משוב חדש מלקוחות','New client feedback'),icon:'chat'});
      if(cap.can('approvals.manage'))tabs.unshift({id:'approval',label:t('ממתינים לאישור הפניה','Pending submission approvals'),icon:'mine'});
    }
  }
  const activeTab=tabs.some(item=>item.id===tab)?tab:'client_feedback';
  const open=(target:HiringTarget)=>onNavigate('org-jobs',target);
  const openLabel=t('פתיחה במשרה','Open in job');
  return <section className="orgDaily">
    <div className="orgPageHeading"><div><span className="eyebrow" dir="auto">{org.name}</span>
      <h1>{interviewsOnly?t('ראיונות ומשימות','Interviews and tasks'):t('העבודה שלי','My work')}</h1>
      {!interviewsOnly&&<p>{t('פתחו פריט כדי להמשיך לטפל בו.','Open an item to continue working on it.')}</p>}
    </div>{cap.can('tasks.manage')&&<button className="gradientButton" onClick={()=>setShow(!show)}>+ {t('הוספת משימה','Add task')}</button>}</div>
    {error&&<p role="status" className="message">{error}</p>}
    {show&&<form className="detailPanel orgInlineForm" onSubmit={async event=>{
      event.preventDefault();const data=new FormData(event.currentTarget);
      if(await update(()=>db!.from('recruitment_tasks').insert({organization_id:org.id,created_by:userId,title:String(data.get('title')).trim(),due_date:String(data.get('due'))||null})))setShow(false);
    }}><h2>{t('משימה חדשה','New task')}</h2><label>{t('משימה','Task')}<input name="title" required maxLength={240}/></label>
      <label>{t('מועד','Due date')}<input name="due" type="date"/></label>
      <button disabled={busy}>{t('שמירה','Save')}</button><button type="button" onClick={()=>setShow(false)}>{t('ביטול','Cancel')}</button>
    </form>}
    <section className="orgTablePanel recruitmentQueue" aria-busy={loading}>
      <div className="orgViewTabs">{tabs.map(item=><button key={item.id} aria-pressed={activeTab===item.id} onClick={()=>setTab(item.id)}>
        <UiIcon name={item.icon} size={17}/> {item.label} {item.count!=null&&<span className="badge">{item.count}</span>}
      </button>)}</div>
      {loading&&<p className="queueEmpty" role="status">{t('טוען את העבודה שלך…','Loading your work…')}</p>}
      {!loading&&activeTab==='tasks'&&<>{tasks.map(task=><article className="orgWorkRow" key={task.id}>
        <input type="checkbox" aria-label={t('השלמת משימה','Complete task')} disabled={busy||!cap.can('tasks.manage')}
          onChange={()=>void update(()=>db!.from('recruitment_tasks').update({done:true}).eq('organization_id',org.id).eq('id',task.id))}/>
        <b dir="auto">{task.title}</b>{task.due_date&&task.due_date<today&&<span className="badge queueOverdue">{t('עבר המועד','Overdue')}</span>}
        <small>{task.due_date?new Date(task.due_date+'T12:00:00').toLocaleDateString(locale):t('ללא מועד','No due date')}</small>
      </article>)}{!tasks.length&&<p className="queueEmpty">{t('אין משימות פתוחות.','No open tasks.')}</p>}</>}
      {!loading&&activeTab==='interviews'&&<>{interviews.map(item=><article className="orgWorkRow" key={item.id}>
        <UiIcon name="interviews"/><b>{dateTime(item.starts_at)}</b><span dir="auto">{item.notes||t('ראיון מתוכנן','Scheduled interview')}</span>
        <button onClick={()=>open(item.target)}>{openLabel}</button>
      </article>)}{!interviews.length&&<p className="queueEmpty">{t('אין ראיונות קרובים.','No upcoming interviews.')}</p>}</>}
      {!loading&&activeTab==='applications'&&<>{newApplications.slice(0,20).map(item=><article className="orgWorkRow" key={item.id}>
        <UiIcon name="jobs"/><div><b dir="auto">{applicantNames[item.candidate_id]||t('מועמדות חדשה','New application')}</b><small dir="auto">{item.job?.title}</small></div><small>{dateTime(item.created_at)}</small>
        <button onClick={()=>open({jobId:item.job!.id,recordId:item.id})}>{t('פתיחת מועמדות','Open application')}</button>
      </article>)}{!newApplications.length&&<p className="queueEmpty">{t('אין מועמדויות חדשות.','No new applications.')}</p>}
      {newApplications.length>20&&<button className="queueMore" onClick={()=>onNavigate('org-jobs')}>{t('לכל המועמדויות','All applications')}</button>}</>}
      {!loading&&(activeTab==='approval'||activeTab==='client_feedback')&&<>
        {(activeTab==='approval'?approvals:feedback).map(item=><article className="orgWorkRow" key={item.event_id}>
          <UiIcon name={item.kind==='approval'?'mine':'chat'}/><div><b dir="auto">{item.candidate_name}</b><small dir="auto">{item.job_title}</small></div><small>{dateTime(item.occurred_at)}</small>
          <button onClick={()=>open({jobId:item.job_id,recordId:item.record_id,manual:true})}>{item.kind==='approval'?t('בדיקת בקשה','Review request'):t('פתיחת משוב','Open feedback')}</button>
          {item.kind==='client_feedback'&&<button disabled={busy} onClick={()=>void update(()=>db!.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',userId).eq('id',item.event_id))}>{t('סימון כנקרא','Mark as read')}</button>}
        </article>)}
        {queueError?<p className="queueEmpty" role="status">{t('לא ניתן היה לטעון את התור.','The queue could not be loaded.')} <button onClick={()=>setReload(value=>value+1)}>{t('ניסיון נוסף','Retry')}</button></p>:
          !(activeTab==='approval'?approvals:feedback).length&&<p className="queueEmpty">{activeTab==='approval'?t('אין בקשות אישור שממתינות לטיפולך.','No approval requests need your review.'):t('אין משוב חדש בתור.','No new feedback in the queue.')}</p>}
        {activeTab==='client_feedback'&&<button className="queueMore" onClick={()=>onNavigate('notifications')}>{t('לכל ההתראות','All notifications')}</button>}
      </>}
    </section>
    {!interviewsOnly&&<nav className="orgQuickLinks" aria-label={t('גישה מהירה','Quick access')}>
      {agency?<><button onClick={()=>onNavigate('org-candidates')}>{t('מאגר מועמדים','Candidate pool')}</button>
        {cap.can('jobs.manage')&&<button onClick={()=>onNavigate('org-clients')}>{t('ניהול לקוחות','Manage clients')}</button>}</>:
        <button onClick={()=>onNavigate('org-jobs')}>{t('מעבר למשרות ולהקצאת מועמדויות','Jobs and application assignment')}</button>}
      <button onClick={()=>onNavigate('org-interviews')}>{t('לוח ראיונות ומשימות','Interviews and tasks')}</button>
    </nav>}
  </section>;
}
