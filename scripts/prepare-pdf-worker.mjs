import {createRequire} from 'node:module';
import {copyFileSync,mkdirSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// PDF.js rejects a worker whose version differs from the browser library.
// A versioned URL also keeps a cached worker from a previous release separate.
const require=createRequire(import.meta.url);
const version=require('pdfjs-dist/package.json').version;
if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Unexpected PDF.js version');
const source=resolve(dirname(require.resolve('pdfjs-dist/package.json')),'build/pdf.worker.min.mjs');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const target=resolve(root,'public',`pdf.worker.${version}.min.mjs`);
mkdirSync(dirname(target),{recursive:true});
copyFileSync(source,target);
if(!readFileSync(source).equals(readFileSync(target)))throw Error('PDF worker copy failed');
console.log(`Prepared PDF.js worker ${version}`);
