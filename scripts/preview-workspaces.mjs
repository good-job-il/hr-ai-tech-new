// Local UI fixture only. Never uses credentials, production data or a remote API.
// Run from repository root: node scripts/preview-workspaces.mjs
import http from 'node:http';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const roles=['candidate','agency','employer','limited'];
const caps=['jobs.manage','reports.read','team.configure','organization.manage','candidates.write','candidates.all','tasks.manage'];
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const users=Object.fromEntries(roles.map((role,index)=>[role,{id:id(index+1),aud:'authenticated',role:'authenticated',email:`${role}@example.invalid`,email_confirmed_at:'2026-01-01T00:00:00Z',user_metadata:{account_type:role==='limited'?'employer':role,full_name:`QA ${role}`},app_metadata:{provider:'email',providers:['email']},created_at:'2026-01-01T00:00:00Z'}]));
function token(role){const user=users[role];return [Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000),aud:'authenticated',role:'authenticated',fixture_role:role})).toString('base64url'),'local-fixture-not-a-real-signature'].join('.')}
const server=http.createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:3212');
  res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,HEAD,POST,OPTIONS');
  res.setHeader('Access-Control-Expose-Headers','Content-Range');res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
  let input='';for await(const chunk of req)input+=chunk;
  let body={};try{body=JSON.parse(input||'{}')}catch{}
  const path=new URL(req.url,'http://127.0.0.1').pathname;
  let role;try{role=JSON.parse(Buffer.from(req.headers.authorization?.split('.')[1]??'','base64url')).fixture_role}catch{}
  const user=users[role];const kind=role==='agency'?'agency':'employer';const org={id:id(role==='agency'?11:12),name:`QA ${kind}`,kind};
  const send=value=>{res.setHeader('Content-Range',Array.isArray(value)?(value.length?`0-${value.length-1}/${value.length}`:'*/0'):'*/0');res.end(JSON.stringify(value))};
  if(path==='/auth/v1/token'){
    const selected=String(body.email??'').split('@')[0];
    if(!roles.includes(selected)){res.statusCode=400;send({error:'invalid_grant'});return}
    send({access_token:token(selected),refresh_token:`fixture-${selected}`,token_type:'bearer',expires_in:3600,user:users[selected]});return;
  }
  if(path==='/auth/v1/logout'){send({});return}
  if(path==='/auth/v1/user'){send(user??{});return}
  if(path==='/rest/v1/public_job_catalog'){send([]);return}
  const rpc=path.split('/rpc/')[1];
  if(rpc){
    if(rpc==='is_platform_admin'){send(false);return}
    if(rpc==='my_capabilities'){send(role==='limited'?[]:caps);return}
    if(rpc==='client_portal_data'){send({clients:[],presentations:[]});return}
    if(rpc==='my_account_data'){send({full_name:user?.user_metadata.full_name,contact_phone:'0500000000',account_type:user?.user_metadata.account_type});return}
    if(rpc==='search_candidate_pool'){
      // One synthetic record makes ownership UI and details inspectable.
      send({rows:[{id:id(99),owner_id:id(98),full_name:'QA Synthetic Candidate',email:'fixture@example.invalid',phone:'0500000000',visibility:'personal',created_at:'2026-01-01T00:00:00Z'}],count:1});return;
    }
    if(rpc==='list_candidate_duplicate_pairs'||rpc==='public_featured_job_ids'||rpc==='team_directory'){send([]);return}
    res.statusCode=403;send({code:'42501',message:'Fixture does not implement mutations or this RPC'});return;
  }
  if(path==='/rest/v1/memberships'){send(user&&role!=='candidate'?[{role:role==='limited'?'internal_coordinator':'org_admin',organization_id:org.id,organization:org}]:[]);return}
  if(path==='/storage/v1/object/list/candidate-cvs'){send([]);return}
  if(path.startsWith('/rest/v1/')&&['GET','HEAD'].includes(req.method)){
    const single=String(req.headers.accept).includes('vnd.pgrst.object');
    if(path.endsWith('/candidate_profiles')){send({user_id:user?.id,full_name:'QA Candidate',phone:'0500000000'});return}
    if(path.endsWith('/candidate_saved_filters')){send([{id:id(90),name:'QA legacy personal filter',filters:{pool:'personal'}}]);return}
    send(single?null:[]);return;
  }
  res.statusCode=403;send({code:'42501',message:'Read-only local fixture; mutation refused'});
});
server.listen(54329,'127.0.0.1',()=>{
  console.log('LOCAL SYNTHETIC UI ONLY: http://127.0.0.1:3212 — no production Auth/RLS verification.');
  console.log('Fixture login: candidate/agency/employer/limited@example.invalid; any nonempty 8-character password.');
  const env={...process.env};
  for(const key of Object.keys(env))if(/SECRET|SERVICE_ROLE|OPENAI|DATABASE|POSTGRES|VERCEL|SUPABASE|^PG|^DB_/.test(key))delete env[key];
  Object.assign(env,{NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54329',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'local-ui-fixture-not-a-production-key'});
  const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port','3212'],{cwd:process.cwd(),env,stdio:'inherit'});
  child.on('exit',code=>server.close(()=>process.exit(code??1)));
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{child.kill(signal);server.close()});
});
