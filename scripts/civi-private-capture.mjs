// Loopback-only UI for saving authorized Civi DOM exports without printing PII.
// No Supabase connection, file uploads, Civi writes, or outbound requests.
import http from 'node:http';
import path from 'node:path';
import {stageCiviSnapshot} from '../lib/civi-sample-staging.mjs';
const origin='http://127.0.0.1:3213';
const directory=path.resolve('output/civi-candidate-sample-20261124/private/ui');
let saved=0,reused=0;
const page=()=>`<!doctype html><html lang="en"><meta charset="utf-8"><title>Private Civi sample capture</title><body><h1>Private local Civi sample</h1><p>Local archive only. No client sends or cloud import.</p><p role="status">Saved ${saved}; reused ${reused}</p><form method="post" action="/capture"><label>Private sample JSON<textarea name="snapshot" required rows="12" cols="80"></textarea></label><button>Save private snapshot</button></form></body></html>`;
http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'none'; form-action 'self'; frame-ancestors 'none'");
  if(req.headers.host!=='127.0.0.1:3213'){res.writeHead(403);res.end();return}
  if(req.method==='GET'&&req.url==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(page());return}
  if(req.method!=='POST'||req.url!=='/capture'||req.headers.origin!==origin){res.writeHead(403);res.end();return}
  try{
    let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>5*1024*1024)throw Error('LIMIT')}
    const data=JSON.parse(new URLSearchParams(body).get('snapshot'));
    const result=stageCiviSnapshot(directory,data);result.created?saved++:reused++;
    res.writeHead(303,{Location:'/'});res.end();
  }catch{res.writeHead(400,{'Content-Type':'text/plain'});res.end('Capture rejected; no raw data logged.');}
}).listen(3213,'127.0.0.1',()=>console.log('Private capture UI: '+origin+' (Git-ignored local archive only)'));
