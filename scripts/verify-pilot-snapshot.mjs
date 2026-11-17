import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const reportPath=process.argv[2];
if(!reportPath)throw new Error('A private output report path is required');
let stage='input',pg;const started=Date.now();
try{
 const chunks=[];for await(const chunk of process.stdin)chunks.push(chunk);const b=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 assert.equal(b.format,'hr-ai-private-snapshot-v1');assert.equal(b.project_ref,'rnstsczayhzrxzcstzpr');
 const qi=s=>'"'+s.replaceAll('"','""')+'"';
 pg=new PGlite();stage='provider-stubs';
 await pg.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb not null default '{}',raw_app_meta_data jsonb not null default '{}',deleted_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;grant usage on schema public,auth,storage to anon,authenticated;grant select,insert on storage.objects to authenticated;`);
 for(const raw of b.auth.users){const u=JSON.parse(raw);await pg.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data,deleted_at) values($1,$2,$3,$4::jsonb,$5::jsonb,$6)',[u.id,u.email,u.email_confirmed_at,JSON.stringify(u.raw_user_meta_data??{}),JSON.stringify(u.raw_app_meta_data??{}),u.deleted_at]);}
 for(const migration of b.migrations){stage='migration-'+migration.version;assert(migration.statements?.length);for(const sql of migration.statements)await pg.exec(sql);}
 const tables=Object.keys(b.tables);stage='table-set';
 assert.deepEqual((await pg.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map(x=>x.tablename),tables.slice().sort());
 await pg.exec('set session_replication_role=replica;truncate '+tables.map(t=>'public.'+qi(t)).join(',')+' cascade');
 for(const table of tables){stage='restore-'+table;const columns=(await pg.query("select attname from pg_attribute where attrelid=$1::regclass and attnum>0 and not attisdropped and attgenerated='' order by attnum",['public.'+table])).rows.map(x=>qi(x.attname));if(b.tables[table].length)await pg.query('insert into public.'+qi(table)+'('+columns.join(',')+') select '+columns.join(',')+' from jsonb_populate_recordset(null::public.'+qi(table)+',$1::jsonb)',['['+b.tables[table].join(',')+']']);assert.equal((await pg.query('select count(*)::int n from public.'+qi(table))).rows[0].n,b.tables[table].length);}
 await pg.exec('set session_replication_role=origin');stage='foreign-keys';
 const fks=(await pg.query("select conrelid::regclass::text tbl,conname,pg_get_constraintdef(oid) definition from pg_constraint where contype='f' and connamespace='public'::regnamespace")).rows;
 for(const c of fks){await pg.exec('alter table '+c.tbl+' drop constraint '+qi(c.conname));await pg.exec('alter table '+c.tbl+' add constraint '+qi(c.conname)+' '+c.definition);}
 stage='outsider-rls';await pg.query("select set_config('request.jwt.claim.sub','99000000-0000-4000-8000-000000000099',false)");await pg.exec('set role authenticated');
 for(const table of ['candidates','applications','candidate_profiles','support_tickets'])assert.equal((await pg.query('select count(*)::int n from public.'+qi(table))).rows[0].n,0);
 const report={result:'PASS_LOCAL_APPLICATION_RESTORE',at:new Date().toISOString(),project:b.project_ref,snapshotAt:b.snapshot_at,tables:tables.length,rows:Object.values(b.tables).reduce((n,x)=>n+x.length,0),migrations:b.migrations.length,foreignKeysRevalidated:fks.length,elapsedSeconds:(Date.now()-started)/1000,cloudRestore:false,authLoginTested:false,storageBytesRestored:false,limitations:['Disposable local PGlite, not a separate Supabase project.','Auth user metadata/IDs modeled for FK/RLS; Auth service, credentials, sessions and actual login not restored/tested.','Storage file bytes and service configuration excluded.']};
 fs.writeFileSync(reportPath,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(e){const report={result:'FAIL_LOCAL_RESTORE',stage,code:e.code??'CHECK_FAILED',cloudRestore:false};fs.writeFileSync(reportPath,JSON.stringify(report,null,2));console.log(JSON.stringify(report));process.exitCode=1;}finally{await pg?.close();}
