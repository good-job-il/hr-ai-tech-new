'use client';
import {useId,useMemo,useState} from 'react';
import {regionPickerOptions} from '../lib/region-picker.mjs';

export default function RegionPicker({jobs,lang,value,onChange}:{jobs:{location:string}[];lang:'he'|'en';value:string;onChange:(key:string)=>void}){
 const he=lang==='he',id=useId(),[open,O]=useState(false),[query,Q]=useState(''),[active,A]=useState(-1);
 const all=useMemo(()=>regionPickerOptions(jobs,lang),[jobs,lang]);
 const options=useMemo(()=>regionPickerOptions(jobs,lang,query),[jobs,lang,query]);
 function close(){O(false);Q('');A(-1)}
 function choose(key:string){onChange(key);close()}
 return <div className="locationAutocomplete regionAutocomplete" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))close()}}>
  <input role="combobox" aria-label={he?'אזור':'Region'} aria-autocomplete="list" aria-expanded={open} aria-controls={id} aria-activedescendant={open&&active>=0?id+'-'+active:undefined} autoComplete="off"
   placeholder={he?'כל האזורים':'All regions'} value={open?query:(value?all.find(r=>r.key===value)?.label??'':'')}
   onFocus={()=>{O(true);Q('');A(-1)}} onChange={e=>{Q(e.target.value);O(true);A(-1)}}
   onKeyDown={e=>{
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();O(true);if(options.length)A(i=>i<0?(e.key==='ArrowDown'?0:options.length-1):(i+(e.key==='ArrowDown'?1:-1)+options.length)%options.length)}
    else if(e.key==='Enter'&&open){e.preventDefault();const option=options[active>=0?active:0];if(option)choose(option.key)}
    else if(e.key==='Escape'&&open){e.preventDefault();e.stopPropagation();close()}
    else if(e.key==='Tab')close();
   }}/>
  {open&&<div className="locationMenu"><ul id={id} role="listbox" aria-label={he?'אזורים לחיפוש משרות':'Regions for job search'} onClick={e=>e.preventDefault()}>
   {options.map((r,i)=><li key={r.key} id={id+'-'+i} role="option" aria-selected={active>=0?i===active:r.key===value} onMouseMove={()=>A(i)} onPointerDown={e=>{e.preventDefault();choose(r.key)}}><bdi dir="auto">{r.label}</bdi><span>{r.count.toLocaleString()}</span></li>)}
   {!options.length&&<li role="presentation" className="locationSuggestionHint">{he?'לא נמצא אזור תואם':'No matching region'}</li>}
  </ul></div>}
 </div>;
}
