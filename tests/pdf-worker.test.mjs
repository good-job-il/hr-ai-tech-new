import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';

test('Prepared public PDF worker has the exact bytes of the installed PDF.js release',()=>{
 const require=createRequire(import.meta.url),pkg=require.resolve('pdfjs-dist/package.json');
 const {version}=require(pkg);
 execFileSync(process.execPath,['scripts/prepare-pdf-worker.mjs']);
 const published=readFileSync(`public/pdf.worker.${version}.min.mjs`);
 assert.deepEqual(published,readFileSync(resolve(dirname(pkg),'build/pdf.worker.min.mjs')));
 assert.ok(published.length>100000);
});
