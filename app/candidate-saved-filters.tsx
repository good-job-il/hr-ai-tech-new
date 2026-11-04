'use client';
import {useEffect,useState} from 'react';import {db} from '../lib/supabase';
type Saved={id:string;name:string;filters:Record<string,string>};
export default function CandidateSavedFilters({org,userId,lang,filters,onApply}:{org:string;userId:string;lang:'he'|'en';filters:Record<string,string>;onApply:(f:Record<string,string>)=>void}){
 const t=(a:string,b:string)=>lang==='he'?a:b,[rows,R]=useState<Saved[]>([]),[name,N]=useState(''),[message,M]=useState(''),[busy,B]=useState(false);
 async function load(){const r=await db!.from('candidate_saved_filters').select('id,name,filters').eq('organization_id',org).eq('user_id',userId).order('created_at',{ascending:false});if(r.error)M(t('טעינת החיפושים השמורים נכשלה','Unable to load saved searches'));else R(r.data??[])}useEffect(()=>{R([]);void load()},[org,userId]);
 return <div><h3>{t('החיפושים השמורים שלי','My saved searches')}</h3><form onSubmit={async e=>{e.preventDefault();B(true);const r=await db!.from('candidate_saved_filters').insert({organization_id:org,user_id:userId,name:name.trim(),filters});B(false);if(r.error)M(t('שמירת החיפוש נכשלה','Unable to save search'));else{N('');await load()}}}><label>{t('שם החיפוש','Search name')}<input required value={name} maxLength={120} onChange={e=>N(e.target.value)}/></label><button disabled={busy}>{t('שמירת הסינון הנוכחי','Save current filters')}</button></form>{rows.map(r=><button key={r.id} onClick={()=>onApply(r.filters)}>{r.name}</button>)}{!rows.length&&<p>{t('טרם נשמרו חיפושים','No saved searches yet')}</p>}{message&&<p role="status">{message}</p>}</div>
}
