import {test} from 'node:test';import assert from 'node:assert/strict';
import {testDatabase} from './support/database.mjs';
test('Imported Hebrew recovery is reversible, leaves valid/foreign/mixed text untouched and hides the repair journal',async()=>{
 const pg=await testDatabase();try{
  const recover=async value=>(await pg.query('select recover_imported_hebrew_text($1) v',[value])).rows[0].v;
  const expected='מועמד בדיקה — נתניה';
  const damaged=Buffer.from(expected,'utf8').toString('latin1');
  assert.equal(await recover(damaged),expected);
  for(const value of ['עברית תקינה','English','Русский','× multiplication',null,'עברית '+damaged])assert.equal(await recover(value),value);
  assert.equal(await recover(await recover(damaged)),expected);
  await pg.exec('set role anon');await assert.rejects(pg.query('select previous_value from candidate_text_encoding_repairs'));
  await assert.rejects(pg.query('select recover_imported_hebrew_text($1)',[damaged]));
 }finally{await pg.close()}
});
