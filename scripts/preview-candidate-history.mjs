// Loopback-only synthetic UI + actual isolated SQL/RLS functions. No production credentials.
import http from 'node:http';import {spawn} from 'node:child_process';import {createRequire} from 'node:module';
import {testDatabase,actAs} from '../tests/support/database.mjs';
const require=createRequire(import.meta.url),pg=await testDatabase();
const owner='ab450000-0000-4000-8000-000000000001',org='ab450000-0000-4000-8000-000000000011',candidate='ab450000-0000-4000-8000-000000000021',empty='ab450000-0000-4000-8000-000000000022',job='ab450000-0000-4000-8000-000000000031';
await pg.query("insert into auth.users(id,email,email_confirmed_at) values($1,'qa@example.invalid',now())",[owner]);
await pg.query("insert into organizations(id,name,kind,is_test) values($1,'QA agency','agency',true)",[org]);
await pg.query("insert into memberships(organization_id,user_id,role,status) values($1,$2,'org_admin','active')",[org,owner]);
await pg.query("insert into candidates(id,organization_id,owner_id,created_by,full_name,email,visibility) values($1,$2,$3,$3,'דניאל לוי','qa@example.invalid','shared'),($4,$2,$3,$3,'Empty candidate','empty@example.invalid','shared')",[candidate,org,owner,empty]);
await pg.query("update candidates set headline='מנהל תפעול' where id=$1",[candidate]);
await pg.query("insert into jobs(id,organization_id,title,location,type,description,is_public) values($1,$2,'מנהל תפעול','Example','full-time','Synthetic job only',false)",[job,org]);
const document=(await pg.query("insert into candidate_documents(organization_id,candidate_id,object_path,label,uploaded_by,created_at) values($1,$2,'synthetic/not-a-real-storage-object.pdf','קורות חיים.pdf',$3,'2026-11-20T10:00:00Z') returning id",[org,candidate,owner])).rows[0].id;
const kinds=['הפניה למשרה','שיחה טלפונית','עודכן סטטוס','נקלטו קורות חיים'];
const events=Array.from({length:31},(_,i)=>({key:'synthetic-'+i,kind:kinds[i%4],occurred_at:new Date(Date.UTC(2026,10,23-i,8)).toISOString(),source_date_text:new Intl.DateTimeFormat('en-GB',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Jerusalem'}).format(new Date(Date.UTC(2026,10,23-i,8))),author:'צוות הגיוס',body:i===1?'המועמד הביע עניין בתפקיד. סוכם לחזור עם פרטים נוספים.\n'+'הערה מלאה לדוגמה. '.repeat(30):i===2?'הופנה → בטיפול':i===3?'קורות חיים.pdf':i===4?'<script>not executable</script>':'רישום היסטורי לדוגמה בלבד.',job_id:i%2===0?job:null,source_job_id:i%2===0?'':'historical-2',job_label:i%2===0?'מנהל תפעול':'מנהל מחלקה',client_label:'לקוח לדוגמה',document_id:i===3?document:null}));
await pg.query('select import_candidate_source_events($1,$2,$3)',[candidate,'synthetic-record',JSON.stringify(events)]);
await actAs(pg,owner);await pg.query("select add_candidate_internal_note($1,'לתאם שיחת המשך לקראת הראיון.')",[candidate]);
let queue=Promise.resolve();
const server=http.createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:3214');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,HEAD,POST,OPTIONS');res.setHeader('Access-Control-Expose-Headers','Content-Range');res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
 let input='';for await(const chunk of req)input+=chunk;let body={};try{body=JSON.parse(input||'{}')}catch{}
 const pathname=new URL(req.url,'http://127.0.0.1').pathname,rpc=pathname.split('/rpc/')[1];
 const send=(value,status=200)=>{res.statusCode=status;res.setHeader('Content-Range',Array.isArray(value)&&value.length?`0-${value.length-1}/${value.length}`:'*/0');res.end(JSON.stringify(value))};
 if(['candidate_activity','add_candidate_internal_note'].includes(rpc)){
  const work=queue.then(async()=>{try{
   const result=rpc==='candidate_activity'?await pg.query('select candidate_activity($1,$2,$3,$4,$5) data',[body.candidate,body.job_filter??'',body.event_filter??'',body.search_query??'',body.page??0]):await pg.query('select add_candidate_internal_note($1,$2) data',[body.candidate,body.note]);send(result.rows[0].data);
  }catch{send({code:'42501',message:'NOT_PERMITTED'},403)}});queue=work.catch(()=>{});await work;return;
 }
 if(rpc==='my_capabilities'){send(['candidates.write','candidates.all','jobs.manage']);return}
 if(rpc==='search_candidate_pool'){send({rows:[{id:candidate,owner_id:owner,full_name:'דניאל לוי',email:'qa@example.invalid',visibility:'shared',created_at:'2026-11-01T00:00:00Z'}],count:1});return}
 if(rpc==='team_directory'){send([]);return}
 if(pathname==='/rest/v1/candidates'){send({headline:'מנהל תפעול'});return}
 if(pathname==='/rest/v1/candidate_table_preferences'){send(null);return}
 if(pathname==='/rest/v1/candidate_documents'){send([{id:document,label:'קורות חיים.pdf',created_at:'2026-11-20T10:00:00Z'}]);return}
 if(pathname.startsWith('/rest/v1/')&&req.method==='GET'){send([]);return}
 send({code:'42501',message:'Local test fixture refuses this operation'},403);
});
server.listen(54330,'127.0.0.1',()=>{
 const env={...process.env};for(const key of Object.keys(env))if(/SECRET|SERVICE_ROLE|SUPABASE|OPENAI|DATABASE|POSTGRES|VERCEL|^PG|^DB_/.test(key))delete env[key];
 Object.assign(env,{NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54330',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'local-history-fixture-only'});
 const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port','3214'],{cwd:process.cwd(),env,stdio:'inherit'});
 console.log('LOCAL SYNTHETIC SQL/UI: http://127.0.0.1:3214/review/candidate-history');
 child.on('exit',code=>server.close(async()=>{await pg.close();process.exit(code??1)}));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{child.kill(signal);server.close()});
});
