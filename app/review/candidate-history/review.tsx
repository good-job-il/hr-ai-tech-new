'use client';
import {useState} from 'react';
import OrganizationCandidates from '../../organization-candidates';
import CandidateActivity from '../../candidate-activity';
import BrandIcon from '../../brand-icon';import BrandWordmark from '../../brand-wordmark';import UiIcon from '../../ui-icon';
import './review.css';
export default function HistoryReview(){
 const [lang,L]=useState<'he'|'en'>('he'),[mode,M]=useState('card');const he=lang==='he';
 const nav=[['org-work','dashboard','העבודה שלי','My work'],['org-candidates','team','מועמדים','Candidates'],['org-jobs','jobs','משרות ותהליכים','Jobs & processes'],['org-interviews','calendar','ראיונות ומשימות','Interviews & tasks'],['org-clients','employers','לקוחות','Clients'],['org-reports','chart','דוחות','Reports']];
 return <main dir={he?'rtl':'ltr'} className="historyReviewShell">
  <aside className="historyReviewSidebar"><a className="brand" href="/"><BrandIcon/><BrandWordmark/></a><strong>{he?'תעסוקה טובה':'Good Job'}</strong><nav aria-label={he?'תפריט סביבת הארגון':'Organization workspace navigation'}>{nav.map(([view,icon,a,b])=><a key={view} href={'/?view='+view} aria-current={view==='org-candidates'?'page':undefined}><UiIcon name={icon}/>{he?a:b}</a>)}</nav></aside>
  <div className="historyReviewMain"><div className="historyReviewTop"><span><b>{he?'מועמדים':'Candidates'}</b> / {he?'כרטיס מועמד':'Candidate card'}</span><button onClick={()=>L(he?'en':'he')}>{he?'English':'עברית'}</button></div>
   <div className="historyReviewTools"><small>{he?'בדיקה מקומית · נתונים בדיוניים · לא נשלחות הודעות':'Local test · fictional data · no messages sent'}</small><label>{he?'תרחיש בדיקה':'Test scenario'}<select value={mode} onChange={e=>M(e.target.value)}><option value="card">{he?'כרטיס מועמד':'Candidate card'}</option><option value="empty">{he?'מועמד ללא פעילות':'Candidate without activity'}</option><option value="denied">{he?'ללא גישה למועמד':'Candidate access denied'}</option></select></label></div>
   {mode==='card'?<OrganizationCandidates org={{id:'ab450000-0000-4000-8000-000000000011',kind:'agency'}} userId="ab450000-0000-4000-8000-000000000001" lang={lang} onPipeline={()=>{}}/>:<CandidateActivity key={mode} candidate={mode==='empty'?'ab450000-0000-4000-8000-000000000022':'ab450000-0000-4000-8000-000000000099'} lang={lang} onDocuments={()=>{}}/>}
  </div>
 </main>
}
