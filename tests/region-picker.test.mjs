import {test} from 'node:test';
import assert from 'node:assert/strict';
import {regionPickerOptions} from '../lib/region-picker.mjs';
import {regions,regionOptions,regionMatches} from '../lib/job-regions.mjs';
import {knownCityOptions,locationMatches} from '../lib/location-search.mjs';

test('Both languages keep every region, original keys/order/counts and zero-job choices',()=>{
 const jobs=[{location:'נתניה'},{location:'Herzliya'},{location:'ירושלים'},{location:'לא צוין בפרסום'}];
 for(const lang of ['he','en']){
  const options=regionPickerOptions(jobs,lang);
  assert.deepEqual(options.map(r=>r.key),['',...regions.map(r=>r.key)]);
  assert.equal(options[0].count,jobs.length);
  assert.deepEqual(options.slice(1),regionOptions(jobs,lang));
  assert.equal(options.find(r=>r.key==='south').count,0);
  assert.equal(options.find(r=>r.key==='sharon').count,2);
 }
 assert.equal(regionPickerOptions([],'he').length,10);
 assert.ok(regionPickerOptions([],'en').every(r=>r.count===0));
});
test('Typing in either language searches choices without changing geographic matching',()=>{
 const jobs=[{location:'נתניה'},{location:'הרצליה'},{location:'ירושלים'}];
 for(const lang of ['he','en']){
  assert.deepEqual(regionPickerOptions(jobs,lang,'השרון').map(r=>r.key),['sharon']);
  assert.deepEqual(regionPickerOptions(jobs,lang,'Sharon').map(r=>r.key),['sharon']);
  assert.deepEqual(regionPickerOptions(jobs,lang,'tel-aviv').map(r=>r.key),['tel-aviv']);
  assert.deepEqual(regionPickerOptions(jobs,lang,'does-not-exist'),[]);
 }
 const selected=regionPickerOptions(jobs,'he','Sharon')[0].key;
 const cities=knownCityOptions(jobs.filter(j=>regionMatches(j.location,selected)),'he');
 assert.ok(cities.includes('נתניה'));assert.ok(!cities.includes('ירושלים'));
 assert.equal(jobs.filter(j=>regionMatches(j.location,selected)&&locationMatches(j.location,'Netanya')).length,1);
});
