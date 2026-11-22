'use client';
import {useEffect,useRef,useState} from 'react';import dynamic from 'next/dynamic';const CvAutofill=dynamic(()=>import('./cv-autofill'),{ssr:false});const PdfDocumentViewer=dynamic(()=>import('./pdf-document-viewer'),{ssr:false});import {db} from '../lib/supabase';import {cvFileDigest} from '../lib/cv-autofill.mjs';import {useCapabilities} from '../lib/workspace-permissions';
export type CandidateDocument={id:string;object_path:string;label:string;created_at:string};
export function CandidateDocumentView({document,lang}:{document:CandidateDocument;lang:'he'|'en'}){const [url,U]=useState(''),[message,M]=useState('');return <div><button onClick={async()=>{if(url){U('');return}const r=await db!.storage.from('organization-cvs').createSignedUrl(document.object_path,120);if(r.error||!r.data)M(lang==='he'?'פתיחת המסמך נכשלה':'Unable to open document');else U(r.data.signedUrl)}}>{url?(lang==='he'?'סגירת צפייה':'Close viewer'):(lang==='he'?'צפייה במסמך':'View document')} · {document.label}</button>{url&&<PdfDocumentViewer url={url} label={document.label} lang={lang}/>} {message&&<p role="status">{message}</p>}</div>}
export default function CandidateDocuments({org,candidate,userId,lang,onFilled}:{org:string;candidate:string;userId:string;lang:'he'|'en';onFilled?:()=>void}){
 const tr=(a:string,b:string)=>lang==='he'?a:b,cap=useCapabilities(org),context=org+':'+candidate+':'+userId,active=useRef(context);active.current=context;
 const [cvFile,CF]=useState<{file:File;context:string}|null>(null),[cvCurrent,CC]=useState<Record<string,unknown>>({}),[open,O]=useState(false),[files,F]=useState<CandidateDocument[]>([]),[busy,B]=useState(false),[message,M]=useState('');
 const currentFields='id,full_name,email,phone,headline,experience,education,skills,languages,city';
 async function load(){const r=await db!.from('candidate_documents').select('id,object_path,label,created_at').eq('candidate_id',candidate).eq('organization_id',org).order('created_at',{ascending:false});if(active.current!==context)return;if(r.error)M(tr('טעינת המסמכים נכשלה','Unable to load documents'));else F(r.data??[])}
 useEffect(()=>{CF(null);CC({});F([]);M('');B(false);if(open)void load()},[context,open]);
 async function upload(file:File){
  if(file.type!=='application/pdf'||file.size>5242880){M(tr('נדרש PDF עד 5MB','PDF up to 5MB required'));return}
  CF(null);B(true);M('');
  try{
   const digest=await cvFileDigest(file);if(active.current!==context)return;
   const object_path=`${org}/${candidate}/${digest}.pdf`;
   const exists=await db!.from('candidate_documents').select('id').eq('organization_id',org).eq('candidate_id',candidate).eq('object_path',object_path).maybeSingle();
   if(exists.error)throw exists.error;
   if(!exists.data){
    const uploaded=await db!.storage.from('organization-cvs').upload(object_path,file,{contentType:'application/pdf',cacheControl:'0',upsert:false});
    if(uploaded.error&&String((uploaded.error as {statusCode?:string}).statusCode)!=='409')throw uploaded.error;
    const attached=await db!.from('candidate_documents').insert({organization_id:org,candidate_id:candidate,object_path,label:file.name.slice(0,240),uploaded_by:userId});
    if(attached.error&&attached.error.code!=='23505')throw attached.error;
   }
   if(active.current!==context)return;await load();
   const record=await db!.from('candidates').select(currentFields).eq('id',candidate).eq('organization_id',org).single();
   if(active.current!==context)return;
   if(record.error){M(tr('המסמך נשמר. לא ניתן לטעון פרטים למילוי אוטומטי; בדוק הרשאה ועדכון מערכת.','Document saved. Unable to load autofill details; check access and system update.'));return}
   CC(record.data);CF({file,context});M(tr('המסמך נשמר. קורא פרטים למילוי השדות הריקים.','Document saved. Reading details to fill empty fields.'));
  }catch{if(active.current===context)M(tr('לא ניתן להשלים את העלאת המסמך ושיוכו. מידע קיים לא שונה.','Unable to complete the upload and attachment. Existing information was not changed.'))}
  finally{if(active.current===context)B(false)}
 }
 return <div className="candidateDocuments"><button type="button" aria-expanded={open} onClick={()=>O(!open)}>{tr('קורות חיים ומסמכים','CV and documents')}</button>{open&&<>
  <p className="muted">{tr('המסמכים פרטיים לארגון ונגישים לפי הרשאות המועמד.','Documents are private to the organization and follow candidate access permissions.')}</p>
  {files.map(f=><article key={f.id}><CandidateDocumentView document={f} lang={lang}/><small>{new Date(f.created_at).toLocaleDateString(lang)}</small>{cap.can('cv.download')&&<button type="button" disabled={busy} onClick={async()=>{B(true);try{const p=await db!.rpc('candidate_document_download',{document:f.id});if(p.error)throw p.error;const r=await db!.storage.from('organization-cvs').download(p.data);if(r.error||!r.data)throw r.error;const objectUrl=URL.createObjectURL(r.data),link=document.createElement('a');link.href=objectUrl;link.download=f.label;link.click();setTimeout(()=>URL.revokeObjectURL(objectUrl),60000)}catch{M(tr('אין הרשאת הורדה או שהפעולה נכשלה','Download denied or failed'))}finally{B(false)}}}>{tr('הורדה מורשית','Authorized download')}</button>}</article>)}
  {!files.length&&<p>{tr('טרם נוספו מסמכים','No documents added yet')}</p>}
  {cap.can('candidates.write')&&<label>{tr('העלאת PDF עד 5MB','Upload PDF up to 5MB')}<input type="file" accept="application/pdf" disabled={busy} onChange={e=>{const input=e.currentTarget,file=input.files?.[0];input.value='';if(file)void upload(file)}}/></label>}
  {cvFile?.context===context&&<CvAutofill key={context} file={cvFile.file} current={cvCurrent} scope="organization" lang={lang} onClose={()=>CF(null)} onApply={async details=>{
   if(active.current!==context)throw Error('CV_CONTEXT_CHANGED');
   const r=await db!.rpc('fill_candidate_from_cv',{candidate,details});if(r.error)throw r.error;
   const record=await db!.from('candidates').select(currentFields).eq('id',candidate).eq('organization_id',org).single();if(record.error)throw record.error;
   if(active.current!==context)throw Error('CV_CONTEXT_CHANGED');CC(record.data);window.dispatchEvent(new CustomEvent('hh-candidate-profile-updated',{detail:{id:candidate}}));onFilled?.();return r.data?.filled??[];
  }}/>}
  {message&&<p role="status">{message}</p>}
 </>}</div>;
}
