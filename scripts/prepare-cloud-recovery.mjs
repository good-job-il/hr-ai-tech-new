// Generates a private restore file. Never log its contents or commit the output.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const [appPath,authPath,target,out]=process.argv.slice(2);
assert.equal(target,'hegfwnvxfrorvbknusej','Only the explicitly approved empty recovery project is supported');
const app=JSON.parse(fs.readFileSync(appPath)),auth=JSON.parse(fs.readFileSync(authPath));
assert.equal(app.project_ref,'ruejyiromtthygqtpcsy');assert.equal(auth.source_project,app.project_ref);
assert.equal(auth.format,'headhunter-auth-recovery-v1');assert.equal(app.storage_inventory.length,0,'File bytes require a separate restore');
assert.equal(auth.users.length,3);assert(auth.users.every(u=>!Object.keys(u).some(k=>/token/i.test(k))));
const lit=s=>"'"+s.replaceAll("'","''")+"'";
const payload=lit(JSON.stringify({app,auth}));
let sql=`-- PRIVATE recovery data. Target ${target} only. No active sessions or tokens.\n`;
sql+=`do $$begin if current_setting('app.settings.jwt_secret',true) is null then null;end if; if to_regclass('public.organizations') is not null or exists(select 1 from auth.users) then raise exception 'Recovery requires a completely empty target';end if;end$$;\n`;
// Keep payload in a session-local temporary table; the editor executes one script/session.
sql+=`create temporary table hh_recovery_payload(data jsonb);insert into hh_recovery_payload values(${payload}::jsonb);\n`;
sql+=`begin;do $$declare t text;cols text;begin foreach t in array array['users','identities'] loop
 select string_agg(format('%I',attname),', ' order by attnum) into cols from pg_attribute where attrelid=('auth.'||t)::regclass and attnum>0 and not attisdropped and attgenerated='' and attname in(select jsonb_object_keys(data->'auth'->t->0) from hh_recovery_payload);
 execute format('insert into auth.%I (%s) select %s from jsonb_populate_recordset(null::auth.%I,(select data->''auth''->%L from hh_recovery_payload))',t,cols,cols,t,t);
 end loop;end$$;
 -- GoTrue scans token columns as strings; excluded tokens must be empty, never NULL.
 do $$declare c record;begin for c in select column_name from information_schema.columns where table_schema='auth' and table_name='users' and column_name ~* 'token' and data_type in ('text','character varying') loop execute format('update auth.users set %I='''' where %I is null',c.column_name,c.column_name);end loop;end$$;
 commit;\n`;
const dir=new URL('../supabase/migrations/',import.meta.url);
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.sql')&&f.slice(0,3)<=app.schema_migration_version).sort())sql+='\n'+fs.readFileSync(new URL(f,dir),'utf8')+'\n';
sql+=`begin;
do $$declare t text;cols text;pending text[];done text[]:=array[]::text[];progress boolean;expected int;actual int;begin
 select array_agg(key order by key) into pending from hh_recovery_payload,jsonb_object_keys(data->'app'->'tables') key;
 -- Disable application side effects only; foreign keys remain enforced.
 foreach t in array pending loop execute format('alter table public.%I disable trigger user',t);end loop;
 -- All application tables are included; clear only seeded content in this empty recovery project.
 execute 'truncate '||(select string_agg(format('public.%I',x),',') from unnest(pending) x);
 while cardinality(pending)>0 loop
 progress:=false;
 foreach t in array pending loop
 if not exists(select 1 from pg_constraint c join pg_class parent on parent.oid=c.confrelid join pg_namespace n on n.oid=parent.relnamespace where c.contype='f' and c.conrelid=format('public.%I',t)::regclass and n.nspname='public' and parent.relname<>t and not parent.relname=any(done)) then
 select string_agg(format('%I',attname),',' order by attnum) into cols from pg_attribute where attrelid=format('public.%I',t)::regclass and attnum>0 and not attisdropped and attgenerated='';
 execute format('insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I,(select data->''app''->''tables''->%L from hh_recovery_payload))',t,cols,cols,t,t);
 done:=array_append(done,t);pending:=array_remove(pending,t);progress:=true;
 end if;end loop;
 if not progress then raise exception 'Unresolved foreign key dependency: %',pending;end if;
 end loop;
 foreach t in array done loop
 execute format('select count(*) from public.%I',t) into actual;
 select jsonb_array_length(data->'app'->'tables'->t) into expected from hh_recovery_payload;
 if actual<>expected then raise exception 'Row mismatch: %',t;end if;
 execute format('alter table public.%I enable trigger user',t);
 end loop;
end$$;
commit;
select 'PASS_CLOUD_DATA_AND_AUTH_RESTORE' result,(select count(*) from auth.users) accounts,(select count(*) from auth.identities) identities,(select count(*) from public.external_jobs) stored_jobs,(select count(*) from public.external_jobs where publication_status='published') published_jobs,(select count(*) from pg_tables where schemaname='public') application_tables,(select count(*) from pg_class where relnamespace='public'::regnamespace and relkind='r' and relrowsecurity) rls_tables;
drop table hh_recovery_payload;`;
fs.writeFileSync(out,sql,{mode:0o600});
// Supabase editor has a query-size limit. Keep chunks in a private, unexposed schema.
const raw=JSON.stringify({app,auth}),parts=[];for(let i=0;i<raw.length;i+=40000)parts.push(raw.slice(i,i+40000));
const start="do $$begin if to_regclass('public.organizations') is not null or exists(select 1 from auth.users) then raise exception 'Recovery requires an empty target';end if;end$$;create schema hh_recovery;revoke all on schema hh_recovery from public,anon,authenticated;create table hh_recovery.chunks(seq int primary key,part text);";
for(let i=0;i<parts.length;i+=6){let chunk=i===0?start:'';chunk+='insert into hh_recovery.chunks values '+parts.slice(i,i+6).map((p,j)=>`(${i+j},${lit(p)})`).join(',')+';select count(*) as recovery_chunks from hh_recovery.chunks;';fs.writeFileSync(out+'.part'+String(i/6).padStart(2,'0')+'.sql',chunk,{mode:0o600})}
const old=`create temporary table hh_recovery_payload(data jsonb);insert into hh_recovery_payload values(${payload}::jsonb);`;
const replacement="create temporary table hh_recovery_payload(data jsonb);insert into hh_recovery_payload select string_agg(part,'' order by seq)::jsonb from hh_recovery.chunks;";
sql=sql.replace(old,replacement)+'\ndrop schema hh_recovery cascade;';fs.writeFileSync(out+'.final.sql',sql,{mode:0o600});
console.log(JSON.stringify({target,tables:Object.keys(app.tables).length,accounts:auth.users.length,bytes:Buffer.byteLength(sql),chunkBatches:Math.ceil(parts.length/6)}));
