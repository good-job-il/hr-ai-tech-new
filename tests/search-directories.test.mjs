import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogLocalityOptions,localities,localitySuggestions,regionMatches,cityMatches,regions} from '../lib/israel-geography.mjs';
import {roles,fields,roleForJob,roleMatches,fieldMatches,roleOptions,fieldOptions,taxonomyKeywordMatches} from '../lib/career-taxonomy.mjs';
test('official locality snapshot has unique codes, bilingual names and full region assignment',()=>{
 assert.equal(localities.length,1249);assert.equal(new Set(localities.map(c=>c.id)).size,localities.length);
 assert.ok(localities.every(c=>c.he&&c.en&&regions.some(r=>r.key===c.region)));
 assert.ok(localitySuggestions('דימונה','','he').some(c=>c.he==='דימונה'));
 assert.ok(localitySuggestions('עפולה','north','he').some(c=>c.he==='עפולה'));
 assert.equal(localitySuggestions('עפולה','south','he').length,0);
 assert.ok(localitySuggestions('קרית שמונה','north','he').some(c=>c.he==='קריית שמונה'));
});
test('geography recognizes bilingual aliases and does not invent cities from regions',()=>{
 assert.equal(cityMatches('ת"א והמרכז','Tel Aviv'),true);
 assert.equal(cityMatches('Herzliya','הרצליה'),true);
 assert.equal(cityMatches('באר שבע והדרום','9000'),true);
 assert.equal(cityMatches('הצפון','עפולה'),false);
 assert.equal(cityMatches('גוש דן','דן'),false);
 assert.equal(cityMatches('אזור המרכז','אזור'),false);
 assert.equal(regionMatches('גוש דן','north'),false);
 assert.equal(regionMatches('Afula','north'),true);
 assert.equal(regionMatches('Dimona','south'),true);
 assert.equal(regionMatches('מרכז שפירא','center'),false);
 assert.equal(regionMatches('תא והמרכז','center'),true);
 assert.equal(regionMatches('לא צוין בפרסום','south'),false);
});
test('taxonomy uses stable role keys and curated aliases instead of whole advertisement titles',()=>{
 assert.equal(fields.length,19);assert.equal(roles.length,117);
 assert.equal(new Set(roles.map(r=>r.id)).size,roles.length);
 const a={title:'מנהל/ת חשבונות עד מאזן | רמת גן (קו רכבת קלה)'};
 assert.equal(roleForJob(a).id,'accountant');assert.equal(fieldMatches(a,'finance'),true);
 assert.equal(roleForJob({title:'Assistant Controller – Jerusalem'}).id,'assistant-controller');
 assert.equal(roleMatches({title:'Assistant Controller'},'controller'),false);
 assert.equal(roleForJob({title:'סמנכ״ל כספים'}).id,'cfo');
 assert.equal(roleForJob({title:'Senior Frontend Developer'}).id,'frontend');
 assert.equal(roleForJob({title:'Unclear vacancy 999'}),null);
});
test('complete dictionaries remain selectable without jobs and domain narrows roles',()=>{
 assert.equal(roleOptions([],'finance','','he').length,10);
 assert.ok(roleOptions([],'finance','הנהלת חשבונות','he').some(r=>r.id==='accountant'&&r.count===0));
 assert.equal(roleOptions([],'finance','frontend','en').length,0);
 assert.equal(fieldOptions([],'he').length,19);
 const jobs=[{title:'Financial Controller'},{title:'Assistant Controller'},{title:'Senior Controller'}];
 assert.equal(roleOptions(jobs,'finance','controller','en').find(r=>r.id==='controller').count,2);
 assert.equal(taxonomyKeywordMatches({title:'מנהל/ת חשבונות'},'bookkeeper'),true);
});

test('catalog cities update from jobs automatically while all-locality mode retains zero counts',()=>{
 const jobs=[{location:'Herzliya'},{location:'הרצליה'},{location:'השרון'}];
 let options=catalogLocalityOptions(jobs,'','sharon','he');
 assert.equal(options.length,1);assert.equal(options[0].count,2);
 assert.equal(catalogLocalityOptions(jobs,'עפולה','north','he').length,0);
 assert.equal(catalogLocalityOptions(jobs,'עפולה','north','he',true)[0].count,0);
 assert.equal(catalogLocalityOptions([...jobs,{location:'Afula'}],'עפולה','north','he')[0].count,1);
 assert.equal(catalogLocalityOptions([{location:'הצפון'}],'עפולה','north','he').length,0);
 assert.equal(catalogLocalityOptions([{location:'Afula'}],'עפולה','south','he',true).length,0);
 assert.equal(catalogLocalityOptions([],'','sharon','en').length,0);
});
