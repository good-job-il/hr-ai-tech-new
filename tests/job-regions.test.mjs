import test from 'node:test';
import assert from 'node:assert/strict';
import {regionMatches,regionOptions} from '../lib/job-regions.mjs';
import {knownCityOptions,locationMatches} from '../lib/location-search.mjs';
test('region and city filters intersect without inventing cities from broad regions',()=>{
 const jobs=[{location:'Herzliya'},{location:'תל אביב, היברידי'},{location:'השרון'},{location:'לא צוין בפרסום'}];
 assert.equal(regionMatches('Herzliya','sharon'),true);
 assert.equal(regionMatches('Herzliya','center'),false);
 assert.equal(regionMatches('לא צוין בפרסום','sharon'),false);
 assert.deepEqual(knownCityOptions(jobs.filter(j=>regionMatches(j.location,'sharon')),'he'),['הרצלייה']);
 assert.equal(jobs.filter(j=>regionMatches(j.location,'sharon')&&locationMatches(j.location,'הרצליה')).length,1);
 assert.equal(regionOptions(jobs,'en').find(r=>r.key==='sharon').count,2);
 assert.equal(regionOptions(jobs,'he').find(r=>r.key==='south').count,0);
});
