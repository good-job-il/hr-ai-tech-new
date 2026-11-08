'use client';
import {useEffect,useState} from 'react';
import {db} from '../lib/supabase';
import {roleLabel} from '../lib/workspace-permissions';
export default function WorkspaceIdentity({userId,email,fallbackName,role,admin,lang,onProfile,active=false,variant='sidebar'}:{userId:string;email:string;fallbackName:string;role:string;admin:boolean;lang:'he'|'en';onProfile:()=>void;active?:boolean;variant?:'sidebar'|'header'}){
 const [name,setName]=useState(''),[title,T]=useState('');
 useEffect(()=>{let alive=true;setName('');T('');const load=()=>{if(db)void db.rpc('my_account_data').then(r=>{if(alive&&!r.error){setName(r.data?.full_name?.trim()??'');T(r.data?.professional_title?.trim()??'')}})};load();window.addEventListener('hh-profile-updated',load);return()=>{alive=false;window.removeEventListener('hh-profile-updated',load)}},[userId]);
 const he=lang==='he',ownerIdentity=admin&&userId==='309617ef-98aa-412c-a972-b38a77a783c0',displayName=name||fallbackName.trim()||(ownerIdentity?'רודיון רבייב':'');
 if(variant==='header')return <button className="workspaceHeaderIdentity" onClick={onProfile} aria-label={he?'פתיחת הפרופיל האישי':'Open personal profile'}><span className="workspaceHeaderAvatar" aria-hidden="true">{(displayName||email).split(' ').filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()}</span><span className="workspaceHeaderPerson"><strong dir="auto">{displayName||(he?'החשבון שלי':'My account')}</strong><small>{title||(ownerIdentity?(he?'מנכ״ל פלטפורמת hr-ai.tech':'CEO, hr-ai.tech platform'):admin?(he?'מנהל הפלטפורמה':'Platform administrator'):role==='client'?(he?'נציג לקוח מורשה':'Authorized client representative'):role?roleLabel(role,he):(he?'מועמד':'Candidate'))}</small></span></button>;
 return <button className="workspaceIdentity" aria-current={active?'page':undefined} onClick={onProfile} aria-label={he?'פתיחת הפרופיל האישי':'Open personal profile'}><strong dir="auto">{displayName||(he?'הוספת שם מלא לפרופיל':'Add your full name')}</strong><small>{title||(ownerIdentity?(he?'מנכ״ל פלטפורמת hr-ai.tech':'CEO, hr-ai.tech platform'):admin?(he?'מנהל הפלטפורמה':'Platform administrator'):role?roleLabel(role,he):(he?'מועמד':'Candidate'))}</small><span className="workspaceEmail" dir="ltr">{email}</span></button>
}

