-- Object definitions only. Never select application records or Auth credentials.
select 'tables' kind, n.nspname||'.'||c.relname key,
 jsonb_build_object('rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity) definition
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p')
union all
select 'columns',n.nspname||'.'||c.relname||'.'||a.attname,
 jsonb_build_object('type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'identity',a.attidentity,'generated',a.attgenerated)
from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
where n.nspname='public' and c.relkind in ('r','p') and a.attnum>0 and not a.attisdropped
union all
select 'functions',n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
 jsonb_build_object('sql',pg_get_functiondef(p.oid),'securityDefiner',p.prosecdef,'config',p.proconfig,'volatility',p.provolatile)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'
union all
select 'indexes',schemaname||'.'||indexname,jsonb_build_object('sql',indexdef) from pg_indexes where schemaname='public'
union all
select 'constraints',n.nspname||'.'||c.relname||'.'||k.conname,
 jsonb_build_object('sql',pg_get_constraintdef(k.oid),'validated',k.convalidated)
from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and k.contype<>'n'
union all
select 'policies',schemaname||'.'||tablename||'.'||policyname,
 jsonb_build_object('permissive',permissive,'roles',roles,'command',cmd,'using',qual,'check',with_check)
from pg_policies where schemaname='public' or (schemaname='storage' and tablename='objects')
union all
select 'triggers',n.nspname||'.'||c.relname||'.'||t.tgname,
 jsonb_build_object('sql',pg_get_triggerdef(t.oid),'enabled',t.tgenabled)
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where not t.tgisinternal and n.nspname in ('public','auth')
union all
select 'buckets',id,jsonb_build_object('name',name,'public',public,'fileSizeLimit',file_size_limit,'allowedMimeTypes',allowed_mime_types) from storage.buckets
order by 1,2;
