begin;
create table public.candidate_import_jobs(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,created_by uuid not null references auth.users,request_id uuid not null,filename text not null check(length(filename) between 1 and 240),total integer not null check(total between 1 and 100000),pool text not null check(pool in('personal','shared')),mapping jsonb not null default '{}',state text not null default 'uploading' check(state in('uploading','ready','running','completed','cancelled')),processed integer not null default 0,added integer not null default 0,duplicates integer not null default 0,invalid integer not null default 0,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),constraint import_job_request_key unique(created_by,request_id));
create table public.candidate_import_rows(job_id uuid not null references public.candidate_import_jobs,row_number integer not null check(row_number>0),payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=16000),status text not null default 'queued' check(status in('queued','created','duplicate','invalid')),candidate_id uuid references public.candidates,reason text,primary key(job_id,row_number));
alter table public.candidate_import_jobs enable row level security;alter table public.candidate_import_rows enable row level security;
create policy import_job_read on public.candidate_import_jobs for select to authenticated using(public.is_member(organization_id) and (created_by=auth.uid() or public.org_capability(organization_id,'candidates.all')));
create policy import_row_read on public.candidate_import_rows for select to authenticated using(exists(select 1 from public.candidate_import_jobs j where j.id=job_id and public.is_member(j.organization_id) and (j.created_by=auth.uid() or public.org_capability(j.organization_id,'candidates.all'))));
revoke all on public.candidate_import_jobs,public.candidate_import_rows from public,anon,authenticated;grant select on public.candidate_import_jobs,public.candidate_import_rows to authenticated;
create function public.start_candidate_import(org uuid,filename text,total integer,pool text,request_id uuid,mapping jsonb default '{}') returns uuid language plpgsql security definer set search_path='' as $$declare bid uuid;k text;begin
 if not public.org_capability(org,'candidates.write') or mapping is null or octet_length(mapping::text)>16000 then raise exception 'Not permitted';end if;
 select kind into strict k from public.organizations where id=org;
 insert into public.candidate_import_jobs(organization_id,created_by,request_id,filename,total,pool,mapping) values(org,auth.uid(),request_id,filename,total,case when k='employer' then 'shared' else pool end,mapping) on conflict on constraint import_job_request_key do nothing returning id into bid;
 if bid is null then select id into strict bid from public.candidate_import_jobs j where j.created_by=auth.uid() and j.request_id=start_candidate_import.request_id and j.organization_id=org and j.filename=start_candidate_import.filename and j.total=start_candidate_import.total and j.mapping=start_candidate_import.mapping;end if;
 return bid;end$$;
create function public.stage_candidate_import(batch uuid,start_row integer,records jsonb) returns integer language plpgsql security definer set search_path='' as $$declare j public.candidate_import_jobs;item jsonb;n integer:=0;previous jsonb;begin
 select * into strict j from public.candidate_import_jobs where id=batch for update;
 if j.created_by<>auth.uid() or not public.org_capability(j.organization_id,'candidates.write') or j.state<>'uploading' then raise exception 'Not permitted';end if;
 if records is null or jsonb_typeof(records)<>'array' or jsonb_array_length(records) not between 1 and 500 or start_row<1 or start_row+jsonb_array_length(records)-1>j.total or octet_length(records::text)>2000000 then raise exception 'INVALID_CHUNK';end if;
 for item in select value from jsonb_array_elements(records) loop
 select payload into previous from public.candidate_import_rows where job_id=batch and row_number=start_row+n;
 if found and previous<>item then raise exception 'CHUNK_CONFLICT';end if;
 insert into public.candidate_import_rows(job_id,row_number,payload) values(batch,start_row+n,item) on conflict do nothing;n:=n+1;end loop;
 update public.candidate_import_jobs set updated_at=now() where id=batch;return n;end$$;
create function public.finish_candidate_import_upload(batch uuid) returns void language plpgsql security definer set search_path='' as $$declare j public.candidate_import_jobs;begin
 select * into strict j from public.candidate_import_jobs where id=batch for update;
 if j.created_by<>auth.uid() or not public.org_capability(j.organization_id,'candidates.write') or j.state<>'uploading' then raise exception 'Not permitted';end if;
 if (select count(*) from public.candidate_import_rows where job_id=batch)<>j.total then raise exception 'INCOMPLETE_UPLOAD';end if;
 update public.candidate_import_jobs set state='ready',updated_at=now() where id=batch;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(j.organization_id,auth.uid(),'candidate_import_jobs',batch,'import_upload_completed',jsonb_build_object('total',j.total));end$$;
create function public.process_candidate_import(batch uuid,chunk_size integer default 200) returns jsonb language plpgsql security definer set search_path='' as $$declare j public.candidate_import_jobs;r public.candidate_import_rows;cid uuid;p jsonb;roles text;role_name text;added_count integer:=0;duplicate_count integer:=0;invalid_count integer:=0;n integer:=0;begin
 select * into strict j from public.candidate_import_jobs where id=batch for update;
 if j.created_by<>auth.uid() or not public.org_capability(j.organization_id,'candidates.write') or j.state not in('ready','running','completed') then raise exception 'Not permitted';end if;
 if chunk_size is null or chunk_size not between 1 and 200 then raise exception 'INVALID_CHUNK';end if;
 if j.state='completed' then return to_jsonb(j);end if;
 for r in select * from public.candidate_import_rows where job_id=batch and status='queued' order by row_number limit chunk_size for update loop
 n:=n+1;p:=r.payload;cid:=null;
 begin
 insert into public.candidates(organization_id,owner_id,full_name,email,phone,visibility) values(j.organization_id,auth.uid(),trim(coalesce(p->>'full_name','')),lower(trim(coalesce(p->>'email',''))),trim(coalesce(p->>'phone','')),j.pool) returning id into cid;
 perform public.save_candidate_professional(cid,p);
 roles:=coalesce(p->>'roles','');
 for role_name in select trim(value) from unnest(string_to_array(roles,';')) value where trim(value)<>'' loop perform public.set_candidate_interest(cid,role_name,coalesce(p->>'domain',''),true,nullif(p->>'interest_confirmed_at','')::date);end loop;
 update public.candidate_import_rows set status='created',candidate_id=cid where job_id=batch and row_number=r.row_number;added_count:=added_count+1;
 exception when unique_violation then
 update public.candidate_import_rows set status='duplicate',reason='EXISTING_CONTACT_NOT_CHANGED' where job_id=batch and row_number=r.row_number;duplicate_count:=duplicate_count+1;
 when check_violation or invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range or raise_exception then
 update public.candidate_import_rows set status='invalid',reason=case when coalesce(p->>'email','')='' and coalesce(p->>'phone','')='' then 'CONTACT_REQUIRED' else 'INVALID_CONTACT_OR_FIELDS' end where job_id=batch and row_number=r.row_number;invalid_count:=invalid_count+1;
 end;
 end loop;
 update public.candidate_import_jobs set processed=processed+n,added=added+added_count,duplicates=duplicates+duplicate_count,invalid=invalid+invalid_count,state=case when processed+n=total then 'completed' else 'running' end,updated_at=now() where id=batch returning * into j;
 if j.state='completed' then insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(j.organization_id,auth.uid(),'candidate_import_jobs',batch,'import_completed',jsonb_build_object('added',j.added,'duplicates',j.duplicates,'invalid',j.invalid));end if;
 return to_jsonb(j);end$$;
revoke all on function public.start_candidate_import(uuid,text,integer,text,uuid,jsonb),public.stage_candidate_import(uuid,integer,jsonb),public.finish_candidate_import_upload(uuid),public.process_candidate_import(uuid,integer) from public,anon;
grant execute on function public.start_candidate_import(uuid,text,integer,text,uuid,jsonb),public.stage_candidate_import(uuid,integer,jsonb),public.finish_candidate_import_upload(uuid),public.process_candidate_import(uuid,integer) to authenticated;
commit;
