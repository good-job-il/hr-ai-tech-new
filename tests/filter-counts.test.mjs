import {test} from 'node:test';
import assert from 'node:assert/strict';
import {roles,fields,fieldForJob,roleForJob,normalizeCareer,fieldOptions,roleOptions} from '../lib/career-taxonomy.mjs';

test('Single-pass filter counts preserve every dictionary option, duplicate count, field and keyword sort',()=>{
 const jobs=roles.flatMap(r=>[r.he,r.en,...r.aliases].map(title=>({title}))).concat([{title:'Unknown position',category:'finance'},{title:'Unknown position'},...Array(3).fill({title:'React Developer'})]);
 for(const lang of ['he','en']){
  const expectedFields=fields.map(f=>({key:f.id,name:f[lang],count:jobs.filter(j=>fieldForJob(j)===f.id).length}));
  const other=jobs.filter(j=>fieldForJob(j)==='unclassified').length;
  if(other)expectedFields.push({key:'unclassified',name:lang==='he'?'טרם סווג':'Unclassified',count:other});
  assert.deepEqual(fieldOptions(jobs,lang),expectedFields);
  for(const [field,query] of [['',''],['software',''],['','React'],['health','אחות']]){
   const q=normalizeCareer(query);
   const expected=roles.filter(r=>(!field||r.field===field)&&(!q||[r.he,r.en,...r.aliases].some(t=>normalizeCareer(t).includes(q)))).map(r=>({id:r.id,name:r[lang],count:jobs.filter(j=>roleForJob(j)?.id===r.id).length})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,lang));
   assert.deepEqual(roleOptions(jobs,field,query,lang),expected);
  }
 }
});
