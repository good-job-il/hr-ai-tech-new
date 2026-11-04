-- Read-only application-data export. No passwords, tokens or auth credentials.
begin;
create temporary table hh_private_backup(payload jsonb) on commit drop;
do $$declare item record; data jsonb; tables jsonb:='{}'::jsonb;begin
 for item in select tablename from pg_tables where schemaname='public' order by tablename loop
 execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from public.%I r',item.tablename) into data;
 tables:=tables||jsonb_build_object(item.tablename,data);
 end loop;
 insert into hh_private_backup values(jsonb_build_object('schema_migration_version','031','format','headhunter-application-data-v1','project_ref','ruejyiromtthygqtpcsy','created_at',now(),'tables',tables,'auth_ids',(select coalesce(jsonb_agg(id),'[]') from auth.users),'auth_accounts',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'email',email,'email_confirmed_at',email_confirmed_at,'raw_user_meta_data',jsonb_build_object('account_type',raw_user_meta_data->>'account_type'))),'[]') from auth.users),'storage_inventory',(select coalesce(jsonb_agg(jsonb_build_object('bucket_id',bucket_id,'name',name)),'[]') from storage.objects),'limitations','Application data only. Auth credentials and Storage file bytes are not included.'));
end$$;
select payload::text as application_data_backup from hh_private_backup;
commit;
