import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isAuthorizedClient} from '../lib/client-account-context.mjs';
import {availableHelp,featuredHelp,searchHelp} from '../lib/help-knowledge.mjs';

test('Client presentation requires a server portal association, not a signup preference',()=>{
 for(const data of [null,undefined,{}, {clients:[]},{user_metadata:{account_type:'client'}},{clients:null}])assert.equal(isAuthorizedClient(data),false);
 assert.equal(isAuthorizedClient({clients:[{id:'authorized-client'}],presentations:[]}),true);
});

test('Client help covers referrals, feedback, interviews and permitted CVs without candidate or agency actions',()=>{
 const context={audience:'client'};
 assert.deepEqual(featuredHelp(context).map(e=>e.id),['client-referrals','client-feedback','client-interview','client-cv']);
 const entries=availableHelp(context);
 assert.ok(entries.every(e=>['all','client'].includes(e.audience)));
 assert.ok(entries.every(e=>!e.view.startsWith('org-')&&!e.view.startsWith('admin')));
 assert.equal(searchHelp('משוב על מועמד',context)[0].id,'client-feedback');
 assert.equal(searchHelp('shared CV',context)[0].id,'client-cv');
 assert.ok(!availableHelp({audience:'candidate'}).some(e=>e.audience==='client'));
 assert.ok(!availableHelp({audience:'organization',capabilities:[]}).some(e=>e.audience==='client'));
});
