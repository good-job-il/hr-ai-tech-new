import {createRequire} from 'node:module';
import {copyFileSync,mkdirSync,readdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..','public','ocr','v7');
const pkg=name=>dirname(require.resolve(name+'/package.json'));
function copy(from,to){mkdirSync(dirname(to),{recursive:true});copyFileSync(from,to)}
copy(resolve(pkg('tesseract.js'),'dist','worker.min.js'),resolve(root,'worker.min.js'));
for(const file of readdirSync(pkg('tesseract.js-core')))if(/\.wasm(?:\.js)?$/.test(file))copy(resolve(pkg('tesseract.js-core'),file),resolve(root,'core',file));
for(const language of ['heb','eng'])copy(resolve(pkg('@tesseract.js-data/'+language),'4.0.0_best_int',language+'.traineddata.gz'),resolve(root,'lang',language+'.traineddata.gz'));
const fonts=resolve(pkg('pdfjs-dist'),'standard_fonts'),fontTarget=resolve(root,'..','..',`pdf-fonts.${require('pdfjs-dist/package.json').version}`);
for(const file of readdirSync(fonts))copy(resolve(fonts,file),resolve(fontTarget,file));
console.log('Prepared local Hebrew/English OCR assets');
