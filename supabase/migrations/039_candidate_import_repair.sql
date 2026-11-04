begin;
create table public.candidate_import_repairs(job_id uuid primary key references public.candidate_import_jobs,actor_id uuid not null references auth.users,created_at timestamptz not null default now(),original_result jsonb not null,requeued integer not null,date_repairs integer not null,date_skipped integer not null);
create table public.candidate_import_date_repairs(job_id uuid not null references public.candidate_import_jobs,candidate_id uuid not null references public.candidates,previous_date date,repaired_date date,changed_at timestamptz not null,restored_at timestamptz,primary key(job_id,candidate_id));
alter table public.candidate_import_rows add column previous_result jsonb;
alter table public.candidate_import_repairs enable row level security;alter table public.candidate_import_date_repairs enable row level security;
create policy import_repairs_read on public.candidate_import_repairs for select to authenticated using(exists(select 1 from public.candidate_import_jobs j where j.id=job_id and public.is_member(j.organization_id) and (j.created_by=auth.uid() or public.org_capability(j.organization_id,'candidates.all'))));
create policy import_date_repairs_read on public.candidate_import_date_repairs for select to authenticated using(public.can_read_candidate(candidate_id));
revoke all on public.candidate_import_repairs,public.candidate_import_date_repairs from public,anon,authenticated;grant select on public.candidate_import_repairs,public.candidate_import_date_repairs to authenticated;
create function public.repair_candidate_import(batch uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare j public.candidate_import_jobs;r record;c public.candidates;d date;n integer:=0;fixed integer:=0;skipped integer:=0;stamp timestamptz;begin
 select * into strict j from public.candidate_import_jobs where id=batch for update;
 if j.created_by<>auth.uid() or not public.org_capability(j.organization_id,'candidates.write') then raise exception 'Not permitted';end if;
 if exists(select 1 from public.candidate_import_repairs where job_id=batch) then return to_jsonb(j);end if;
 if j.state<>'completed' then raise exception 'IMPORT_NOT_COMPLETED';end if;
 for r in select ir.candidate_id,ir.payload from public.candidate_import_rows ir where job_id=batch and status='created' and candidate_id is not null and payload?'source_last_updated_at' order by row_number loop
 select * into c from public.candidates where id=r.candidate_id for update;
 if not found or c.merged_into is not null or c.updated_at>j.updated_at then skipped:=skipped+1;continue;end if;
 begin d:=public.candidate_source_date(r.payload->>'source_last_updated_at');exception when others then skipped:=skipped+1;continue;end;
 if c.source_last_updated_at is distinct from d then
 update public.candidates set source_last_updated_at=d where id=c.id returning updated_at into stamp;
 insert into public.candidate_import_date_repairs(job_id,candidate_id,previous_date,repaired_date,changed_at) values(batch,c.id,c.source_last_updated_at,d,stamp);
 fixed:=fixed+1;end if;
 end loop;
 update public.candidate_import_rows set previous_result=jsonb_build_object('status',status,'reason',reason),status='queued',reason=null where job_id=batch and status='invalid';get diagnostics n=row_count;
 insert into public.candidate_import_repairs(job_id,actor_id,original_result,requeued,date_repairs,date_skipped) values(batch,auth.uid(),to_jsonb(j),n,fixed,skipped);
 update public.candidate_import_jobs set processed=processed-n,invalid=0,state=case when n>0 then 'ready' else 'completed' end,updated_at=now() where id=batch returning * into j;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(j.organization_id,auth.uid(),'candidate_import_jobs',batch,'import_format_repair',jsonb_build_object('requeued',n,'dates_corrected',fixed,'dates_skipped_changed_record',skipped));
 return to_jsonb(j);
end$$;
create function public.restore_import_candidate_date(batch uuid,candidate uuid) returns void language plpgsql security definer set search_path='' as $$declare j public.candidate_import_jobs;r public.candidate_import_date_repairs;c public.candidates;begin
 select * into strict j from public.candidate_import_jobs where id=batch;
 if not public.org_capability(j.organization_id,'candidates.all') or not public.org_capability(j.organization_id,'candidates.write') then raise exception 'Not permitted';end if;
 select * into strict r from public.candidate_import_date_repairs where job_id=batch and candidate_id=candidate for update;
 select * into strict c from public.candidates where id=candidate for update;
 if r.restored_at is not null or c.organization_id<>j.organization_id or c.source_last_updated_at is distinct from r.repaired_date or c.updated_at<>r.changed_at or c.merged_into is not null then raise exception 'RESTORE_CONFLICT';end if;
 update public.candidates set source_last_updated_at=r.previous_date where id=candidate;update public.candidate_import_date_repairs set restored_at=now() where job_id=batch and candidate_id=candidate;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(j.organization_id,auth.uid(),'candidates',candidate,'import_date_repair_restored',jsonb_build_object('batch',batch));
end$$;
revoke all on function public.repair_candidate_import(uuid),public.restore_import_candidate_date(uuid,uuid) from public,anon;
grant execute on function public.repair_candidate_import(uuid),public.restore_import_candidate_date(uuid,uuid) to authenticated;
commit;
