import {test} from 'node:test';
import assert from 'node:assert/strict';
import {workspaceViewAllowed as allowed, resolveWorkspaceView as resolve, workspaceNavigationVisible as visible} from '../lib/workspace-navigation.mjs';
import {publicAccountNavigation} from '../lib/public-account-navigation.mjs';
import {availableHelp} from '../lib/help-knowledge.mjs';

const candidate={signedIn:true,ready:true};
const employer={...candidate,org:{id:'employer',kind:'employer'},capabilities:[]};
const employerManager={...employer,capabilities:['jobs.manage','reports.read','team.configure']};
const owner={...employerManager,capabilities:[...employerManager.capabilities,'organization.manage','rewards.read']};
const agency={...owner,org:{id:'agency',kind:'agency'}};
const client={...candidate,client:true};
const admin={...candidate,admin:true};
const candidateViews=['notifications','dashboard','saved','mine','workspace'];
const managementViews=['admin','admin-orgs','settings','team','pipeline','org-work','org-candidates','org-team','org-clients','org-rewards','org-billing','org-connections'];

test('Candidate keeps personal tools without marketing, recruiting or technical menu entries',()=>{
  for(const view of [...candidateViews,'career','jobs','account-profile','support']) assert.equal(visible(view,candidate),true,view);
  for(const view of ['employers',...managementViews,'client-portal']) assert.equal(visible(view,candidate),false,view);
  // The public marketing page remains reachable deliberately from the public site.
  assert.equal(allowed('employers',candidate),true);
});

test('Direct links cannot mount business or administration components for a candidate',()=>{
  for(const view of managementViews) assert.equal(resolve(view,candidate),'dashboard',view);
  for(const view of candidateViews) assert.equal(resolve(view,candidate),view);
});

test('Employer has recruiting tools; candidate and agency-only screens stay outside the workspace',()=>{
  for(const context of [employer,employerManager,owner]) {
    for(const view of ['org-work','org-candidates','org-jobs','org-interviews']) assert.equal(visible(view,context),true);
    assert.equal(visible('org-clients',context),false);
    for(const view of candidateViews.filter(view=>view!=='notifications')) assert.equal(visible(view,context),false);
    // Work notifications are addressed to the member and also cover client feedback.
    assert.equal(resolve('notifications',context),'notifications');
    assert.equal(resolve('workspace',context),'account-profile');
    for(const view of ['dashboard','saved','mine','org-clients']) assert.equal(resolve(view,context),'org-work',view);
    assert.equal(resolve('team',context),'org-work');
    assert.equal(resolve('pipeline',context),'org-jobs');
  }
});

test('Employer management controls follow explicit capabilities, including HR rewards',()=>{
  for(const view of ['org-team','org-partnerships','org-company','org-reports','org-billing','org-connections','org-rewards']) {
    assert.equal(visible(view,employer),false,view);
    assert.equal(resolve(view,employer),'org-work',view);
    assert.equal(visible(view,owner),true,view);
  }
  assert.equal(visible('org-rewards',employerManager),false);
  assert.equal(visible('org-rewards',{...employerManager,capabilities:[...employerManager.capabilities,'rewards.read']}),true);
  assert.equal(visible('org-billing',{...employer,role:'finance'}),true);
  assert.equal(visible('org-connections',{...employer,role:'finance'}),false);
});

test('Agency client management and own reward access are preserved',()=>{
  assert.equal(visible('org-clients',agency),true);
  assert.equal(visible('org-clients',{...agency,capabilities:[]}),false);
  assert.equal(visible('org-rewards',{...agency,capabilities:[]}),true);
  assert.equal(visible('org-rewards',employer),false);
});

test('Client representatives get portal/account destinations and no candidate or agency workspace',()=>{
  for(const view of [...candidateViews,...managementViews]) assert.equal(visible(view,client),false,view);
  assert.equal(visible('client-portal',client),true);
  assert.equal(visible('account-profile',client),true);
  assert.equal(resolve('mine',client),'account-profile');
  const action=publicAccountNavigation('client');
  assert.equal(action.primary,'client-portal');
  assert.equal(action.he,'פורטל לקוח');
  assert.equal(action.en,'Client portal');
});

test('Platform context cannot fall back to candidate or organization components',()=>{
  for(const view of ['team','dashboard','mine','pipeline','org-candidates','org-billing','workspace']) assert.equal(resolve(view,admin),'admin',view);
  for(const view of ['admin','admin-orgs','admin-publications','admin-billing','admin-reports','settings']) assert.equal(visible(view,admin),true);
  for(const view of candidateViews) assert.equal(visible(view,admin),false);
});

test('Loading or signed-out sessions never render a previous private workspace',()=>{
  for(const view of ['org-rewards','dashboard','account-profile','admin']) {
    assert.equal(resolve(view,{...candidate,ready:false}),'account-loading');
    assert.equal(visible(view,{...owner,ready:false}),false);
    assert.equal(resolve(view,{...candidate,signedIn:false}),'jobs');
  }
  for(const view of ['org-company','org-billing','org-team','org-rewards']) {
    assert.equal(resolve(view,{...owner,capabilitiesLoading:true}),'account-loading');
    assert.equal(visible(view,{...owner,capabilitiesLoading:true}),false);
  }
  assert.equal(resolve('org-rewards',owner),'org-rewards');
  assert.equal(resolve('org-rewards',employerManager),'org-work');
  assert.equal(resolve('org-rewards',candidate),'dashboard');
  assert.equal(resolve('org-rewards',client),'account-profile');
});

test('Business signup preference enables onboarding only, never grants organization privileges',()=>{
  const onboarding={...candidate,businessOnboarding:true};
  assert.equal(resolve('team',onboarding),'team');
  for(const view of ['org-candidates','org-billing','admin','settings']) assert.equal(allowed(view,onboarding),false);
  assert.equal(resolve('team',{...client,businessOnboarding:true}),'account-profile');
  const pendingBusiness={...onboarding,businessAccount:true};
  for(const view of candidateViews) {
    assert.equal(visible(view,pendingBusiness),false,view);
    assert.equal(resolve(view,pendingBusiness),'team',view);
  }
  assert.equal(visible('team',pendingBusiness),true);
  assert.equal(visible('account-profile',pendingBusiness),true);
});

test('Existing role-scoped help destinations agree with navigation permissions',()=>{
  for(const [context,help] of [
    [candidate,{audience:'candidate'}],
    [client,{audience:'client'}],
    [admin,{audience:'platform'}],
    [employerManager,{audience:'organization',kind:'employer',capabilities:employerManager.capabilities,commercial:false}],
    [agency,{audience:'organization',kind:'agency',capabilities:agency.capabilities,commercial:true}],
  ]) for(const entry of availableHelp(help)) {
    // Language is an in-drawer action, not a page navigation.
    if(entry.view==='language') continue;
    assert.equal(allowed(entry.view,context),true,`${help.audience}: ${entry.id}`);
  }
});
