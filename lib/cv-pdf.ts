import {parseCvText,cvTextFromItems} from './cv-autofill.mjs';
import type {Worker as OcrWorker} from 'tesseract.js';

export async function readCvFields(file:File,signal:AbortSignal,onProgress:(page:number,total:number,ocr:boolean)=>void){
  if(file.type!=='application/pdf'||file.size>5242880)throw Error('CV_FILE_INVALID');
  const pdfjs=await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc=`/pdf.worker.${pdfjs.version}.min.mjs`;
  const loading=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),enableXfa:false,standardFontDataUrl:`/pdf-fonts.${pdfjs.version}/`});
  let worker:OcrWorker|undefined;
  const abort=()=>{void loading.destroy();void worker?.terminate()};
  signal.addEventListener('abort',abort,{once:true});
  const check=()=>{if(signal.aborted)throw Error('CV_CANCELLED')};
  try{
    check();const pdf=await loading.promise;check();
    if(pdf.numPages>30)throw Error('CV_PAGE_LIMIT');
    let text='',usedOcr=false;
    for(let n=1;n<=pdf.numPages;n++){
      check();onProgress(n,pdf.numPages,false);
      const page=await pdf.getPage(n),content=await page.getTextContent();
      let pageText=cvTextFromItems(content.items);
      if((pageText.match(/\p{L}/gu)??[]).length<40){
        usedOcr=true;onProgress(n,pdf.numPages,true);
        if(!worker){
          const {createWorker,OEM}=await import('tesseract.js');check();
          worker=await createWorker(['heb','eng'],OEM.LSTM_ONLY,{
            workerPath:'/ocr/v7/worker.min.js',corePath:'/ocr/v7/core',langPath:'/ocr/v7/lang',
            workerBlobURL:false,cacheMethod:'none',
          });check();
        }
        const base=page.getViewport({scale:1}),scale=Math.min(2.5,Math.sqrt(2500000/(base.width*base.height)));
        const viewport=page.getViewport({scale}),canvas=document.createElement('canvas');
        canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
        try{
          const task=page.render({canvas,viewport});
          const cancel=()=>task.cancel();signal.addEventListener('abort',cancel,{once:true});
          try{await task.promise}finally{signal.removeEventListener('abort',cancel)}
          check();const result=await worker.recognize(canvas);check();
          if(result.data.confidence<40)throw Error('CV_UNREADABLE');
          pageText=result.data.text;
        }finally{canvas.width=0;canvas.height=0}
      }
      text+=pageText+'\n';page.cleanup();
      if(text.length>200000)throw Error('CV_TEXT_LIMIT');
    }
    check();return {fields:parseCvText(text) as Record<string,string>,usedOcr};
  }finally{
    signal.removeEventListener('abort',abort);
    await worker?.terminate().catch(()=>{});await loading.destroy().catch(()=>{});
  }
}
