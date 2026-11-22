// Read a decrypted snapshot from stdin; emit aggregate planning evidence only.
import {readFile} from 'node:fs/promises';
import {pilotRecoveryPreflight} from '../lib/pilot-recovery-preflight.mjs';
try{
 const descriptor=JSON.parse(await readFile(process.argv[2],'utf8'));
 const chunks=[];for await(const chunk of process.stdin)chunks.push(chunk);
 const snapshot=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 const report=pilotRecoveryPreflight(snapshot,descriptor);
 console.log(JSON.stringify(report));process.exitCode=report.blockers.length?2:0;
}catch{console.log(JSON.stringify({result:'FAIL_PREFLIGHT',privateDetailsPublished:false}));process.exitCode=1;}
