import {test} from 'node:test';import assert from 'node:assert/strict';
import {helpEntries,availableHelp,searchHelp,featuredHelp} from '../lib/help-knowledge.mjs';
import {publicAccountNavigation} from '../lib/public-account-navigation.mjs';
import {commercialEventPresentation} from '../lib/commercial-ledger.mjs';
const platform={audience:'platform',capabilities:[]},candidate={audience:'candidate'},coordinator={audience:'organization',kind:'agency',capabilities:['candidates.write','tasks.manage'],commercial:false},manager={audience:'organization',kind:'agency',capabilities:['organization.manage','team.configure','reports.read','jobs.manage','candidates.write'],commercial:true};
test('Public header sends platform, organization and candidate users to their separate workspaces',()=>{
 assert.equal(publicAccountNavigation('admin').primary,'admin');assert.equal(publicAccountNavigation('admin').account,'account-profile');assert.equal(publicAccountNavigation('admin').he,'ניהול הפלטפורמה');assert.equal(publicAccountNavigation('team').primary,'team');assert.equal(publicAccountNavigation('dashboard').primary,'mine');assert.equal(publicAccountNavigation(undefined).primary,'mine');
});
test('Hebrew and English help search gives real instructions and role-scoped destinations',()=>{
 assert.equal(searchHelp('איך מאריכים ניסיון?',platform)[0].id,'admin-trial');
 assert.equal(searchHelp('extend trial',platform)[0].id,'admin-trial');
 assert.equal(searchHelp('איך מעלים אקסל',coordinator)[0].id,'org-import');
 assert.equal(searchHelp('excel import',manager)[0].id,'org-import');
 assert.equal(searchHelp('איך מחפשים מועמדים לפי חברה',coordinator)[0].id,'org-search');
 assert.equal(searchHelp('איך מעלים קורות חיים',candidate)[0].id,'candidate-profile');
 assert.equal(searchHelp('איפה הסטטוס של המועמדויות שלי',candidate)[0].id,'candidate-applications');
 assert.equal(searchHelp('יתרה כספית',manager)[0].id,'org-billing');
 assert.equal(searchHelp('פניות משתמשים',platform)[0].id,'admin-support');
 assert.equal(searchHelp('zzzzzzzz',platform).length,0);assert.equal(searchHelp('   ',candidate).length,0);
 for(const context of [platform,candidate,coordinator,manager])for(const e of searchHelp('מועמדים תפקיד כסף דוח הרשאות',context))assert.ok(availableHelp(context).includes(e));
 assert.ok(!availableHelp(candidate).some(e=>e.view.startsWith('admin')||e.view.startsWith('org-')));
 assert.ok(!availableHelp(platform).some(e=>e.audience==='candidate'||e.audience==='organization'));
 assert.ok(!availableHelp(coordinator).some(e=>['org-billing','org-team','org-clients'].includes(e.view)));
 assert.ok(!availableHelp({...manager,kind:'employer'}).some(e=>e.view==='org-clients'));
 assert.ok(availableHelp({...coordinator,commercial:true}).some(e=>e.view==='org-billing'));
 assert.ok(featuredHelp(platform).every(e=>e.audience==='platform'));assert.ok(featuredHelp(coordinator).some(e=>e.id==='org-import'));
 assert.equal(new Set(helpEntries.map(e=>e.id)).size,helpEntries.length);
});
test('Ledger distinguishes duration, quota and money, preserves reasons separately and rejects invalid dates',()=>{
 const entry={event_type:'trial_extension',application_delta:300,money_delta_agorot:0,details:{duration:3,unit:'months',trial_until:'2027-02-03T10:00:00Z'}};
 const he=commercialEventPresentation(entry,'he');assert.match(he.title,/מועמדויות/);assert.equal(he.applicationChange,'+300');assert.match(he.durationText,/3 חודשים/);assert.equal(he.financial,false);assert.equal(he.trialUntil,'3.2.2027');
 const en=commercialEventPresentation(entry,'en');assert.equal(en.applicationChange,'+300');assert.match(en.title,/applications added/);assert.match(en.durationText,/3 months/);
 assert.equal(commercialEventPresentation({...entry,application_delta:0},'he').applicationChange,'—');
 assert.equal(commercialEventPresentation({...entry,details:{duration:4,unit:'hours',trial_until:'invalid'}},'he').durationText,'');
 assert.equal(commercialEventPresentation({...entry,details:{trial_until:'invalid'}},'he').trialUntil,'');
 assert.equal(commercialEventPresentation({event_type:'payment_verified',application_delta:0,money_delta_agorot:50000},'en').financial,true);
});
