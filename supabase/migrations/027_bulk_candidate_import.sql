begin;
create table public.candidate_import_batches(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,created_by uuid not null references auth.users,filename text not null check(length(filename) between 1 and 240),added integer not null default 0,skipped integer not null default 0,invalid integer not null default 0,created_at timestamptz not null default now());
alter table public.candidate_import_batches enable row level security;
create policy candidate_import_read on public.candidate_import_batches for select to authenticated using(public.is_member(organization_id) and (created_by=auth.uid() or public.org_capability(organization_id,'candidates.all')));
revoke all on public.candidate_import_batches from public,anon,authenticated;grant select on public.candidate_import_batches to authenticated;
create function public.import_candidates(org uuid,filename text,records jsonb,pool text default 'personal') returns jsonb language plpgsql security definer set search_path='' as $$
declare k text;item jsonb;n integer:=0;added_count integer:=0;skipped_count integer:=0;invalid_count integer:=0;cid uuid;email_value text;phone_value text;results jsonb:='[]';batch uuid;
begin
 if not public.org_capability(org,'candidates.write') then raise exception 'Not permitted';end if;
 select kind into strict k from public.organizations where id=org;
 if records is null or pool is null or jsonb_typeof(records)<>'array' or jsonb_array_length(records) not between 1 and 200 or octet_length(records::text)>1000000 or pool not in ('personal','shared') then raise exception 'INVALID_IMPORT';end if;
 insert into public.candidate_import_batches(organization_id,created_by,filename) values(org,auth.uid(),filename) returning id into batch;
 for item in select value from jsonb_array_elements(records) loop
  n:=n+1;cid:=null;
  begin
   email_value:=lower(trim(coalesce(item->>'email','')));phone_value:=trim(coalesce(item->>'phone',''));
   insert into public.candidates(organization_id,owner_id,full_name,email,phone,visibility) values(org,auth.uid(),trim(coalesce(item->>'full_name','')),email_value,phone_value,case when k='employer' then 'shared' else pool end) returning id into cid;
   added_count:=added_count+1;results:=results||jsonb_build_array(jsonb_build_object('row',n,'status','created','candidate_id',cid));
  exception when unique_violation then
   select coalesce(c.merged_into,c.id) into cid from public.candidates c where c.organization_id=org and (c.email_key=email_value or (public.normalize_candidate_phone(phone_value) is not null and c.phone_key=public.normalize_candidate_phone(phone_value))) limit 1;
   if not public.can_read_candidate(cid) then cid:=null;end if;
   skipped_count:=skipped_count+1;results:=results||jsonb_build_array(jsonb_build_object('row',n,'status','duplicate','candidate_id',cid));
  when others then
   invalid_count:=invalid_count+1;results:=results||jsonb_build_array(jsonb_build_object('row',n,'status','invalid','reason','INVALID_CONTACT_OR_FIELDS'));
  end;
 end loop;
 update public.candidate_import_batches set added=added_count,skipped=skipped_count,invalid=invalid_count where id=batch;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(org,auth.uid(),'candidate_import_batches',batch,'candidate_import',jsonb_build_object('added',added_count,'skipped',skipped_count,'invalid',invalid_count));
 return jsonb_build_object('batch_id',batch,'added',added_count,'skipped',skipped_count,'invalid',invalid_count,'rows',results);
end$$;
create function public.candidate_population() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not public.is_platform_admin() then raise exception 'Not permitted';end if;
 return jsonb_build_object('registered_candidate_accounts',(select count(*) from auth.users where raw_user_meta_data->>'account_type'='candidate'),'candidate_profiles',(select count(*) from public.candidate_profiles),'organization_records',(select count(*) from public.candidates where merged_into is null),'archived_records',(select count(*) from public.candidates where merged_into is not null),'unique_emails',(select count(distinct email) from (select lower(trim(c.email)) email from public.candidates c where merged_into is null union select lower(trim(u.email)) from public.candidate_profiles p join auth.users u on u.id=p.user_id union select lower(trim(u.email)) from auth.users u where u.raw_user_meta_data->>'account_type'='candidate') people));
end$$;
revoke all on function public.import_candidates(uuid,text,jsonb,text),public.candidate_population() from public,anon;
grant execute on function public.import_candidates(uuid,text,jsonb,text),public.candidate_population() to authenticated;
create or replace view public.public_job_catalog with(security_invoker=true) as
 select j.id,false as external,null::text as source_id,j.title,j.location,j.type,left(j.description,280) as description,j.organization_id,o.name as company,j.category,j.work_mode,j.experience_years,j.salary_min,j.salary_max,j.created_at,null::timestamptz as verified_at,'{}'::jsonb as localized_content
 from public.jobs j join public.organizations o on o.id=j.organization_id where j.status='open'
 union all
 select e.id,true,e.source_id,e.title,e.location,coalesce(e.employment_type,'unspecified'),left(e.description,280),null::uuid,s.company,e.department,null::text,null::integer,null::numeric,null::numeric,e.first_seen_at,e.verified_at,case when e.localized_content='{}'::jsonb then '{}'::jsonb else jsonb_build_object('he',jsonb_build_object('title',e.localized_content#>>'{he,title}','description',left(e.localized_content#>>'{he,description}',280)),'en',jsonb_build_object('title',e.localized_content#>>'{en,title}','description',left(e.localized_content#>>'{en,description}',280))) end
 from public.external_jobs e join public.job_sources s on s.id=e.source_id where e.publication_status='published' and e.status='active' and e.verified_at<=now()+interval '5 minutes' and e.verified_at>now()-interval '7 days';

commit;
