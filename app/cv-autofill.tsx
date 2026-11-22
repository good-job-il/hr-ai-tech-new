'use client';
import {useEffect,useRef,useState} from 'react';
import {blankCvFields,cvFieldLabels,cvFieldLimits} from '../lib/cv-autofill.mjs';
import {withoutNiqqud} from '../lib/hebrew-text.mjs';

export default function CvAutofill({file,current,scope,lang,onApply,onClose}:{file:File;current:Record<string,unknown>;scope:'candidate'|'organization';lang:'he'|'en';onApply:(fields:Record<string,string>)=>Promise<string[]>;onClose:()=>void}){
  const he=lang==='he',t=(a:string,b:string)=>he?a:b;
  const [fields,F]=useState<Record<string,string>>({}),[chosen,C]=useState<Record<string,boolean>>({}),[loading,L]=useState(true),[busy,B]=useState(false),[error,E]=useState(''),[message,M]=useState(''),[progress,P]=useState({page:0,total:0,ocr:false});
  const alive=useRef(true);
  useEffect(()=>{alive.current=true;let active=true;const controller=new AbortController();L(true);E('');M('');F({});C({});
    void import('../lib/cv-pdf').then(m=>m.readCvFields(file,controller.signal,(page,total,ocr)=>{if(active)P({page,total,ocr})})).then(result=>{if(!active)return;F(result.fields);C(Object.fromEntries(Object.keys(result.fields).map(k=>[k,true])));L(false)}).catch(e=>{if(!active)return;L(false);E((e as Error).message==='CV_PAGE_LIMIT'?t('הקובץ נשמר. הקריאה האוטומטית מוגבלת ל־30 עמודים; אפשר למלא את הפרטים ידנית.','File saved. Automatic reading supports up to 30 pages; you can enter details manually.'):t('הקובץ נשמר, אך לא הצלחנו לקרוא ממנו פרטים בבטחה. אפשר למלא אותם ידנית.','File saved, but its details could not be read reliably. You can enter them manually.'))});
    return()=>{active=false;alive.current=false;controller.abort()};
  },[file,lang]);
  const eligible=blankCvFields(current,fields,scope) as Record<string,string>;
  const selected=Object.fromEntries(Object.entries(eligible).filter(([key])=>chosen[key]));
  async function apply(){if(!Object.keys(selected).length||busy)return;B(true);E('');M('');try{const keys=await onApply(selected);if(!alive.current)return;M(keys.length?t('הפרטים נוספו לשדות הריקים. מידע קיים נשמר.','Details added to empty fields. Existing information was preserved.'):t('השדות כבר מכילים מידע. שום מידע לא נדרס.','The fields already contain information. Nothing was overwritten.'));C({})}catch{if(alive.current)E(t('המילוי לא נשמר. ייתכן שחסר עדכון מערכת, שההרשאה השתנתה או שפרטי הקשר כבר קיימים. המידע הקיים נשמר.','Autofill was not saved. A system update may be missing, access may have changed, or the contact already exists. Existing information was preserved.'))}finally{if(alive.current)B(false)}}
  return <section className="cvAutofill" aria-label={t('מילוי פרטים מקורות החיים','Fill details from CV')}>
    <div className="cvAutofillHeading"><h3>{t('פרטים מתוך קורות החיים','Details from your CV')}</h3><button type="button" disabled={busy} onClick={onClose}>{loading?t('ביטול קריאה','Cancel reading'):t('סגירה','Close')}</button></div>
    <p>{t('הקריאה מתבצעת במכשיר שלך. בחר אילו שדות ריקים למלא ובדוק את הפרטים לפני השמירה. מידע קיים לא יוחלף.','Reading takes place on your device. Choose empty fields to fill and review the details before saving. Existing information will not be replaced.')}</p>
    {loading&&<p role="status">{progress.ocr?t('מזהה טקסט בעברית ובאנגלית בעמוד סרוק…','Recognizing Hebrew and English in a scanned page…'):t('קורא את קורות החיים…','Reading the CV…')} {progress.total?`${progress.page}/${progress.total}`:''}</p>}
    {!loading&&!error&&!Object.keys(fields).length&&<p role="status">{t('לא נמצאו פרטים שניתן למלא בבטחה. הקובץ נשמר ואפשר להזין פרטים ידנית.','No details could be filled reliably. The file was saved and details can be entered manually.')}</p>}
    {Object.entries(fields).map(([key,value])=>{const canFill=!(scope==='candidate'&&['email','city','languages'].includes(key))&&!String(current[key]??'').trim();const label=(cvFieldLabels as Record<string,string[]>)[key]?.[he?0:1]??key;return <div className="cvAutofillField" key={key}>
      <label className="cvAutofillChoice"><input type="checkbox" checked={canFill&&!!chosen[key]} disabled={!canFill||busy} onChange={e=>C(v=>({...v,[key]:e.target.checked}))}/>{label}</label>
      <textarea aria-label={label} dir="auto" value={value} maxLength={(cvFieldLimits as Record<string,number>)[key]} readOnly={!canFill||busy} onChange={e=>F(v=>({...v,[key]:withoutNiqqud(e.target.value)}))}/>
      {!canFill&&<small>{scope==='candidate'&&['email','city','languages'].includes(key)?t('מוצג לעיון בלבד; אין שינוי בפרטי הכניסה או בהעדפות שלך.','For review only; sign-in details and preferences are not changed.'):t('לשדה כבר יש מידע והוא יישמר ללא שינוי.','This field already contains information and will stay unchanged.')}</small>}
    </div>})}
    {!loading&&Object.keys(fields).length>0&&<button type="button" className="dark" disabled={busy||!Object.keys(selected).length} onClick={()=>void apply()}>{busy?t('שומר…','Saving…'):t('מילוי השדות שנבחרו','Fill selected fields')}</button>}
    {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  </section>;
}
