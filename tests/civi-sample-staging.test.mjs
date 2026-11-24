import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {stageCiviSnapshot} from '../lib/civi-sample-staging.mjs';
test('Repeated source capture is idempotent; changed history creates a revision without losing duplicate events',t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'civi-sample-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const snapshot={sourceId:'123',kind:'events',rows:[{text:'identical'},{text:'identical'}]};
  assert.equal(stageCiviSnapshot(directory,snapshot).created,true);
  assert.equal(stageCiviSnapshot(directory,snapshot).created,false);
  assert.equal(fs.readdirSync(directory).length,1);
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory,fs.readdirSync(directory)[0]))).rows.length,2);
  assert.equal(stageCiviSnapshot(directory,{...snapshot,rows:[...snapshot.rows,{text:'new'}]}).created,true);
  assert.equal(fs.readdirSync(directory).length,2);
  assert.equal(stageCiviSnapshot(directory,{...snapshot,sourceId:'124'}).created,true);
  assert.throws(()=>stageCiviSnapshot(directory,{...snapshot,sourceId:'../other'}),/INVALID_SOURCE/);
});
