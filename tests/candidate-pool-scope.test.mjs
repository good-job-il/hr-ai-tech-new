import {test} from 'node:test';
import assert from 'node:assert/strict';
import {candidatePoolScope} from '../lib/candidate-pool-scope.mjs';

test('Legacy personal saved filters cannot narrow the employer organization pool',()=>{
  for(const value of ['all','mine','shared','personal','invalid',undefined]) {
    assert.equal(candidatePoolScope('employer',value),'all');
  }
});

test('Agency scopes are preserved and invalid saved values fall back safely',()=>{
  for(const value of ['all','mine','shared','personal']) assert.equal(candidatePoolScope('agency',value),value);
  assert.equal(candidatePoolScope('agency','invalid'),'all');
  assert.equal(candidatePoolScope(undefined,'personal'),'all');
});
