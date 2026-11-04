'use client';
import {useId,useMemo,useState} from 'react';
import {fieldOptions,careerLabel} from '../lib/career-taxonomy.mjs';
export default function FieldPicker({jobs,lang,value,onChange}:{jobs:{title?:string;category?:string|null}[];lang:'he'|'en';value:string;onChange:(value:string)=>void}){
 const he=lang==='he',id=useId(),[open,O]=useState(false),[query,Q]=useState(''),[active,A]=useState(-1);
 const fields=useMemo(()=>fieldOptions(jobs,lang),[jobs,lang]);
 const options=[{key:'',name:he?'כל התחומים':'All fields',count:jobs.length},...fields].filter(f=>!query||f.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 function choose(name:string){onChange(name);Q('');O(false);A(-1)}
 return <div className="fieldPicker" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null)){O(false);Q('');A(-1)}}}>
 <input role="combobox" aria-label={he?'חיפוש ובחירת תחום':'Search and select field'} aria-expanded={open} aria-controls={id} aria-autocomplete="list" aria-activedescendant={open&&active>=0?id+'-'+active:undefined} autoComplete="off" placeholder={he?'כל התחומים — הקלד לחיפוש':'All fields — type to search'} value={open?query:(value?careerLabel(value,lang):'')} onFocus={()=>{O(true);Q('');A(-1)}} onChange={e=>{Q(e.target.value);O(true);A(-1)}} onKeyDown={e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();O(true);if(options.length)A(i=>(i+(e.key==='ArrowDown'?1:-1)+options.length)%options.length)}else if(e.key==='Enter'&&open){e.preventDefault();if(options[active>=0?active:0])choose(options[active>=0?active:0].key)}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();O(false);Q('');A(-1)}}}/>
 {open&&<ul id={id} role="listbox" onClick={e=>e.preventDefault()} aria-label={he?'תחומים במשרות הפתוחות':'Fields in open jobs'}>{options.map((f,i)=><li id={id+'-'+i} key={f.key} role="option" aria-selected={i===active||active<0&&f.key===value} onMouseMove={()=>A(i)} onPointerDown={e=>{e.preventDefault();choose(f.key)}}><bdi dir="auto">{f.name||(he?'כל התחומים':'All fields')}</bdi><span>{f.count.toLocaleString()}</span></li>)}{!options.length&&<li role="presentation">{he?'לא נמצא תחום תואם':'No matching field'}</li>}</ul>}
 </div>;
}
