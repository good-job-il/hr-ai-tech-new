import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateJob,filterJobs,canTransition} from '../lib/domain.mjs';
const job={title:'מפתח React',location:'Tel Aviv',description:'Build products',type:'full-time',organization:{name:'Acme'}};
test('job accepts complete input and rejects missing or excessive data',()=>{assert.equal(validateJob(job),null);for(const key of ['title','location','description'])assert.equal(validateJob({...job,[key]:''}),key);assert.equal(validateJob({...job,title:'x'.repeat(121)}),'title');assert.equal(validateJob({...job,type:'invalid'}),'type')});
test('search supports Hebrew, employer, case and employment filters',()=>{assert.equal(filterJobs([job],'מפתח','all').length,1);assert.equal(filterJobs([job],'ACME','full-time').length,1);assert.equal(filterJobs([job],'react','contract').length,0);assert.equal(filterJobs([job],'missing','all').length,0)});
test('pipeline rejects unknown stages and no-op changes',()=>{assert.equal(canTransition('submitted','interview'),true);assert.equal(canTransition('hired','hired'),false);assert.equal(canTransition('submitted','unknown'),false)});

test('combined location, category and work arrangement filters are applied together',()=>{const roles=[{...job,location:'Haifa',category:'Engineering',work_mode:'remote'},{...job,location:'Haifa',category:'Sales',work_mode:'remote'},{...job,location:'Jerusalem',category:'Engineering',work_mode:'onsite'}];assert.equal(filterJobs(roles,'react','all',{location:'HAIFA',category:'Engineering',workMode:'remote'}).length,1);assert.equal(filterJobs(roles,'react','all',{location:'Haifa',category:'Engineering',workMode:'onsite'}).length,0)});
