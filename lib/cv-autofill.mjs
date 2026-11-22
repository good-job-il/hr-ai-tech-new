import {withoutNiqqud} from './hebrew-text.mjs';

export const cvFieldLabels = {
  full_name:['שם מלא','Full name'],email:['דוא״ל מהמסמך','Email in document'],phone:['טלפון','Phone'],
  headline:['תיאור מקצועי','Professional headline'],experience:['ניסיון תעסוקתי','Experience'],
  education:['השכלה','Education'],skills:['כישורים','Skills'],languages:['שפות','Languages'],city:['עיר מגורים','City'],
};
export const cvFieldLimits={full_name:160,email:254,phone:40,headline:240,experience:8000,education:4000,skills:2000,languages:1000,city:240};
export async function cvFileDigest(file){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');}
export function cvTextFromItems(items){return items.filter(item=>'str'in item).map(item=>item.str+(item.hasEOL?'\n':' ')).join('');}
const headings={
  experience:/^(?:work(?:ing)? experience|professional experience|employment(?: history)?|experience|ניסיון (?:תעסוקתי|תעסוקת[׳']|מקצועי)|נסיון (?:תעסוקתי|תעסוקת[׳']|מקצועי)|תעסוקה)$/iu,
  education:/^(?:education|academic background|השכלה(?: אקדמית)?|לימודים)$/iu,
  skills:/^(?:technical skills|skills|core competencies|כישורים|מיומנויות|כישורים טכניים|ידע מקצועי)$/iu,
  languages:/^(?:languages|שפות)$/iu,
};
const nameLabel=/^(?:full name|name|שם מלא|שם)\s*[:：]\s*(.+)$/iu;
const titleLabel=/^(?:professional (?:title|headline)|job title|headline|תיאור מקצועי|תפקיד)\s*[:：]\s*(.+)$/iu;
const cityLabel=/^(?:city|עיר(?: מגורים)?)\s*[:：]\s*(.+)$/iu;
const ignoredHeading=/^(?:curriculum vitae|resume|résumé|cv|קורות חיים|פרטים אישיים|personal (?:details|information)|contact(?: details)?|פרטי קשר|references|ממליצים|summary|profile|תקציר|military service|שירות צבאי|volunteering|התנדבות)\s*[:：]?$/iu;

/** Conservative extraction: keep source wording, never infer missing facts or dates. */
export function parseCvText(source) {
  if(typeof source!=='string'||source.length>200000)throw Error('CV_TEXT_LIMIT');
  const lines=withoutNiqqud(source).replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu,'').split(/\r?\n/).map(s=>s.replace(/[\t ]+/g,' ').trim()).filter(Boolean);
  const fields={};let section='',sections={};
  for(const line of lines){
    const [label,value]=line.split(/[:：](.*)/su);
    const key=Object.keys(headings).find(k=>headings[k].test(label.trim()));
    if(key){section=key;sections[key]??=[];if(value?.trim())sections[key].push(value.trim());continue}
    if(ignoredHeading.test(line)){section='';continue}
    const name=line.match(nameLabel),title=line.match(titleLabel),city=line.match(cityLabel);
    if(name){fields.full_name??=name[1];section='';continue}
    if(title){fields.headline??=title[1];section='';continue}
    if(city){fields.city??=city[1];section='';continue}
    if(section)sections[section].push(line);
  }
  for(const [key,values] of Object.entries(sections))if(values.length)fields[key]=values.join('\n');
  const text=lines.join('\n');
  const emails=[...new Set(text.match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,}/giu)??[])];
  if(emails.length===1)fields.email=emails[0];
  const phoneCandidates=[...text.matchAll(/(?:\+\d[\d ()-]{7,24}\d|\b0[2-9][\d ()-]{6,14}\d\b)/gu)].map(m=>m[0].trim());
  const phones=[...new Set(phoneCandidates.filter(p=>/^(?:0\d{8,9}|\+\d{8,15})$/.test(p.replace(/[ ()-]/g,''))))];
  if(phones.length===1)fields.phone=phones[0];
  // Unlabelled names are accepted only on the first content line, never from body text.
  if(!fields.full_name){
    const first=lines.find(line=>!ignoredHeading.test(line));
    if(first&&/^[\p{L}][\p{L} .'’־-]{1,100}$/u.test(first)&&first.split(/\s+/u).length>=2&&first.split(/\s+/u).length<=5&&!Object.values(headings).some(re=>re.test(first))&&!/\b(?:engineer|developer|manager|skills|experience)\b|מנהל|מפתח|מהנדס/iu.test(first))fields.full_name=first;
  }
  return Object.fromEntries(Object.entries(fields).filter(([key,value])=>value&&value.length<=cvFieldLimits[key]));
}

/** A selected proposal can fill blanks only, including after another editor changed the record. */
export function blankCvFields(current,proposed,scope='candidate') {
  return Object.fromEntries(Object.entries(proposed).filter(([key,value])=>
    key in cvFieldLimits&&!(scope==='candidate'&&['email','languages','city'].includes(key))&&
    typeof value==='string'&&value.trim()&&value.length<=cvFieldLimits[key]&&
    (current[key]===null||current[key]===undefined||String(current[key]).trim()==='')
  ).map(([key,value])=>[key,withoutNiqqud(value.trim())]));
}
