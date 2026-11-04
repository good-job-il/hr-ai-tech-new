begin;
alter table public.external_jobs alter column verified_at drop not null;
alter table public.external_jobs alter column verification_method drop not null;
create table public.job_import_batches(id uuid primary key default gen_random_uuid(),created_by uuid not null references auth.users,filename text not null check(length(filename)<=240),payload jsonb not null check(jsonb_typeof(payload)='array' and jsonb_array_length(payload) between 1 and 200),status text not null default 'pending' check(status in ('pending','completed','failed')),added integer not null default 0,skipped integer not null default 0,error text,created_at timestamptz not null default now(),completed_at timestamptz);
alter table public.job_import_batches enable row level security;
create policy import_batch_read on public.job_import_batches for select to authenticated using(public.is_platform_admin());
revoke all on public.job_import_batches from anon,authenticated;grant select on public.job_import_batches to authenticated;
create function public.stage_job_import(filename text,records jsonb) returns uuid language plpgsql security definer set search_path='' as $$declare batch uuid;begin
 if not public.is_platform_admin() then raise exception 'Not permitted';end if;
 if octet_length(records::text)>2000000 then raise exception 'Import too large';end if;
 insert into public.job_import_batches(created_by,filename,payload) values(auth.uid(),filename,records) returning id into batch;return batch;end$$;
create function public.process_job_import(batch uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare b public.job_import_batches;item jsonb;added_count integer:=0;changed integer;begin
 if not public.is_platform_admin() then raise exception 'Not permitted';end if;
 select * into strict b from public.job_import_batches where id=batch for update;
 if b.status<>'pending' then raise exception 'Batch is already processed';end if;
 begin
 for item in select value from jsonb_array_elements(b.payload) loop
  if coalesce(item->>'source_id','')!~'^[a-z0-9-]{1,60}$' or coalesce(item->>'source_url','')!~'^https://[^[:space:]]+$' or length(trim(coalesce(item->>'company','')))=0 or length(trim(coalesce(item->>'title','')))=0 or length(trim(coalesce(item->>'location','')))=0 then raise exception 'Missing or invalid source, company, title or location';end if;
  if not exists(select 1 from public.job_sources where id=item->>'source_id') then
   if coalesce(item->>'career_url','')!~'^https://[^[:space:]]+$' then raise exception 'A new source requires a valid career URL';end if;
   insert into public.job_sources(id,company,career_url) values(item->>'source_id',item->>'company',item->>'career_url');
  end if;
  insert into public.external_jobs(source_id,source_url,title,location,department,employment_type,description,responsibilities,requirements,benefits,verified_at,verification_method,publication_status)
  values(item->>'source_id',item->>'source_url',item->>'title',item->>'location',nullif(item->>'department',''),nullif(item->>'employment_type',''),item->>'description',item->>'responsibilities',item->>'requirements',item->>'benefits',null,null,'draft') on conflict(source_url) do nothing;
  get diagnostics changed=row_count;added_count=added_count+changed;
 end loop;
 update public.job_import_batches set status='completed',added=added_count,skipped=jsonb_array_length(b.payload)-added_count,completed_at=now() where id=batch;
 insert into public.management_audit(actor_id,entity_type,entity_id,action,details) values(auth.uid(),'job_import_batches',batch,'import_completed',jsonb_build_object('added',added_count,'skipped',jsonb_array_length(b.payload)-added_count));
 return jsonb_build_object('success',true,'added',added_count,'skipped',jsonb_array_length(b.payload)-added_count);
 exception when others then update public.job_import_batches set status='failed',error=sqlerrm,completed_at=now() where id=batch;return jsonb_build_object('success',false,'message','Invalid import data. No jobs were added.');end;
end$$;
revoke all on function public.stage_job_import(text,jsonb),public.process_job_import(uuid) from public,anon;grant execute on function public.stage_job_import(text,jsonb),public.process_job_import(uuid) to authenticated;
create function public.verify_imported_job(vacancy uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.is_platform_admin() then raise exception 'Not permitted';end if;
 update public.external_jobs set verified_at=now(),verification_method='public-browser',publication_status='review' where id=vacancy and status='active' and length(description)>0;
 if not found then raise exception 'Job needs a description before verification';end if;end$$;
revoke all on function public.verify_imported_job(uuid) from public,anon;grant execute on function public.verify_imported_job(uuid) to authenticated;
create table public.health_samples(id uuid primary key default gen_random_uuid(),actor_id uuid not null references auth.users,success boolean not null,latency_ms integer not null check(latency_ms between 0 and 120000),checked_at timestamptz not null default now());
alter table public.health_samples enable row level security;
create policy health_read on public.health_samples for select to authenticated using(public.is_platform_admin());
create policy health_insert on public.health_samples for insert to authenticated with check(public.is_platform_admin() and actor_id=auth.uid());
revoke all on public.health_samples from anon,authenticated;grant select,insert on public.health_samples to authenticated;
create table public.automation_rules(organization_id uuid primary key references public.organizations,create_task_on_application boolean not null default false,updated_at timestamptz not null default now());
alter table public.automation_rules enable row level security;
create policy automation_read on public.automation_rules for select to authenticated using(public.has_role(organization_id,array['owner','admin','recruiter']));
create policy automation_write on public.automation_rules for all to authenticated using(public.has_role(organization_id,array['owner','admin'])) with check(public.has_role(organization_id,array['owner','admin']));
revoke all on public.automation_rules from anon,authenticated;grant select,insert,update on public.automation_rules to authenticated;
alter table public.recruitment_tasks add column application_id uuid unique references public.applications;
create function public.application_task_automation() returns trigger language plpgsql security definer set search_path='' as $$declare org uuid;job_title text;begin
 select organization_id,title into org,job_title from public.jobs where id=new.job_id;
 if org is not null and exists(select 1 from public.automation_rules where organization_id=org and create_task_on_application) then
 insert into public.recruitment_tasks(organization_id,created_by,title,application_id) values(org,new.candidate_id,left('New application: '||job_title,240),new.id) on conflict(application_id) do nothing;
 end if;return new;end$$;
create trigger application_task_automation after insert on public.applications for each row execute function public.application_task_automation();
commit;
