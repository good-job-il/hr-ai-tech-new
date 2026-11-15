import {createClient} from '@supabase/supabase-js';
import {accessSync, constants} from 'node:fs';
import {serverConfigurationErrors, probeServerStorage} from './supabase-server-check.mjs';

const args = process.argv.slice(2);
let probe = false, envFile;
for (let i = 0; i < args.length; i++) {
 if (args[i] === '--probe' && !probe) probe = true;
 else if (args[i] === '--config' && !envFile && args[i + 1] && !args[i + 1].startsWith('--')) envFile = args[++i];
 else {console.error('Usage: npm run check:supabase -- [--config .env] [--probe]'); process.exit(1);}
}
if (envFile) {
 try {accessSync(envFile, constants.R_OK); process.loadEnvFile(envFile);}
 catch {console.error('FAIL: unable to load the requested environment file.'); process.exit(1);}
}
const errors = serverConfigurationErrors(process.env);
if (errors.length) {
 for (const error of errors) console.error(`FAIL: ${error}`);
 process.exit(1);
}
console.log('PASS: Production configuration shape. No key values were printed.');
if (!probe) {
 console.log('NOT VERIFIED: key validity, Storage access, Vercel access and CV revocation. Use --probe for synthetic Storage checks.');
} else {
 try {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
   auth:{persistSession:false, autoRefreshToken:false, detectSessionInUrl:false},
   global:{fetch:(input, init) => fetch(input, {...init, signal:AbortSignal.timeout(15000), cache:'no-store', redirect:'error'})},
  });
  const report = await probeServerStorage(client);
  for (const result of report) console.log(JSON.stringify(result));
  if (report.some(result => !result.passed)) process.exitCode = 1;
  console.log('NOT VERIFIED: user permissions, old URLs/CDN, CV revocation, PDF browser UI and Vercel runtime.');
 } catch {console.error('FAIL: server check could not complete; request details suppressed.'); process.exitCode = 1;}
}
