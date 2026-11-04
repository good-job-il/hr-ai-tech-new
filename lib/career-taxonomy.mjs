import taxonomy from './data/career-taxonomy.json' with {type:'json'};
export const fields=taxonomy.fields,roles=taxonomy.roles;
export const normalizeCareer=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/[״׳]/g,'').replace(/["'״׳.,/()–—_-]/g,' ').replace(/\s+/g,' ').trim();
const indexed=roles.map(r=>({...r,terms:[r.he,r.en,...r.aliases].map(normalizeCareer)}));
const cache=new Map();
export function roleForJob(job){const title=normalizeCareer(job.title);if(cache.has(title))return cache.get(title);let best=null,score=0;for(const r of indexed)for(const term of r.terms){if(term.length<2)continue;if((' '+title+' ').includes(' '+term+' ')&&term.length>score){best=roles.find(x=>x.id===r.id);score=term.length}}if(cache.size>4000)cache.clear();cache.set(title,best);return best}
const sourceFields={'ניהול':'management','finance':'finance','כספים ופיננסים':'finance','r&d':'software','engineering':'software','operations':'operations','gtm':'sales','marketing':'marketing','product':'product','human resources':'hr','customer tech & ai':'service','customer success':'service','partnerships':'sales','consulting (sales)':'sales','ceo office':'management','design':'product','security':'infrastructure','services':'service'};
export function fieldForJob(job){return roleForJob(job)?.field??sourceFields[normalizeCareer(job.category)]??'unclassified'}
export function careerLabel(id,lang='he'){return [...fields,...roles].find(x=>x.id===id)?.[lang]??id}
export function fieldMatches(job,id){return !id||fieldForJob(job)===id||(!fields.some(f=>f.id===id)&&job.category===id)}
export function roleMatches(job,id){return !id||roleForJob(job)?.id===id}
export function fieldOptions(jobs,lang){const options=fields.map(f=>({key:f.id,name:f[lang],count:jobs.filter(j=>fieldForJob(j)===f.id).length}));const other=jobs.filter(j=>fieldForJob(j)==='unclassified').length;if(other)options.push({key:'unclassified',name:lang==='he'?'טרם סווג':'Unclassified',count:other});return options}
export function roleOptions(jobs,field,query,lang){const q=normalizeCareer(query);return indexed.filter(r=>(!field||r.field===field)&&(!q||r.terms.some(t=>t.includes(q)))).map(r=>({id:r.id,name:r[lang],count:jobs.filter(j=>roleMatches(j,r.id)).length})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,lang))}
export function taxonomyKeywordMatches(job,query){const q=normalizeCareer(query);if(q.length<2)return false;const r=roleForJob(job);return !!r&&indexed.find(x=>x.id===r.id).terms.some(t=>t===q)}
