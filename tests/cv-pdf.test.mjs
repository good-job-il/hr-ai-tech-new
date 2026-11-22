import {before,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {parseCvText,cvTextFromItems,cvFileDigest} from '../lib/cv-autofill.mjs';
const require=createRequire(import.meta.url),root=fileURLToPath(new URL('..',import.meta.url));
before(()=>execFileSync(process.execPath,[resolve(root,'scripts/prepare-ocr.mjs')],{stdio:'pipe'}));

test('Actual Hebrew and English PDFs yield Unicode fields; repeated document digests are stable',async()=>{
  const pdf=await import('pdfjs-dist/legacy/build/pdf.mjs');
  for(const lang of ['he','en']){
    const data=await readFile(new URL(`./fixtures/cv-autofill/${lang}-text.pdf`,import.meta.url));
    const loading=pdf.getDocument({data:new Uint8Array(data),standardFontDataUrl:resolve(dirname(require.resolve('pdfjs-dist/package.json')),'standard_fonts')+'/'});
    try{
      const doc=await loading.promise,page=await doc.getPage(1),content=await page.getTextContent();
      const fields=parseCvText(cvTextFromItems(content.items));
      assert.equal(fields.full_name,lang==='he'?'מאיה לוי':'Maya Demo');assert.equal(fields.email,'maya@example.invalid');assert.equal(fields.phone,lang==='he'?'050-000-1234':'+1 202 555 0148');
      assert.equal(fields.headline,lang==='he'?'מפתחת תוכנה':'Software engineer');assert.ok(fields.experience);assert.ok(fields.education);assert.ok(fields.skills);
      const blob=new Blob([data]);assert.equal(await cvFileDigest(blob),await cvFileDigest(blob));
      assert.notEqual(await cvFileDigest(blob),await cvFileDigest(new Blob(['other document'])));
    }finally{await loading.destroy()}
  }
});

test('Actual image-only Hebrew and English PDFs are rasterized and read with local OCR models',async()=>{
  const {createWorker,OEM}=await import('tesseract.js');
  const {createCanvas}=require('@napi-rs/canvas');
  const pdf=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const worker=await createWorker(['heb','eng'],OEM.LSTM_ONLY,{langPath:resolve(root,'public/ocr/v7/lang'),cacheMethod:'none'});
  try{for(const lang of ['he','en']){
    const data=await readFile(new URL(`./fixtures/cv-autofill/${lang}-scan.pdf`,import.meta.url));
    const loading=pdf.getDocument({data:new Uint8Array(data),standardFontDataUrl:resolve(dirname(require.resolve('pdfjs-dist/package.json')),'standard_fonts')+'/'});
    try{
      const doc=await loading.promise,page=await doc.getPage(1);assert.equal(cvTextFromItems((await page.getTextContent()).items).trim(),'');
      const viewport=page.getViewport({scale:2.5}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
      await page.render({canvas,viewport}).promise;
      const result=await worker.recognize(canvas.toBuffer('image/png'));
      assert.ok(result.data.confidence>=40,lang);
      const fields=parseCvText(result.data.text);
      assert.equal(fields.email,'maya@example.invalid',lang);
      assert.equal(fields.full_name,lang==='he'?'מאיה לוי':'Maya Demo',lang);
      assert.equal(fields.phone,lang==='he'?'050-000-1234':'+1 202 555 0148',lang);
      assert.ok(fields.education,lang);assert.ok(fields.experience,lang);
    }finally{await loading.destroy()}
  }}finally{await worker.terminate()}
});
