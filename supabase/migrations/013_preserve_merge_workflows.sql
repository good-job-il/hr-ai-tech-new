begin;
create or replace function public.merge_candidates(source uuid,target uuid) returns void language plpgsql security definer set search_path='' as $$
declare s public.candidates; t public.candidates;
begin
 if source=target then raise exception 'Choose distinct records';end if;
 perform id from public.candidates where id in(source,target) order by id for update;
 select * into strict s from public.candidates where id=source;
 select * into strict t from public.candidates where id=target;
 if s.organization_id<>t.organization_id or s.merged_into is not null or t.merged_into is not null or not public.has_role(s.organization_id,array['owner','admin']) then raise exception 'Not permitted';end if;
 -- Merging never exposes private placement notes to a wider candidate pool.
 if s.visibility<>t.visibility or (s.visibility='personal' and s.owner_id<>t.owner_id) then raise exception 'MERGE_POOL_MISMATCH';end if;
 perform id from public.candidate_placements where candidate_id in($1,$2) order by id for update;
 -- Conflicting processes may have different stages and interviews. Keep both untouched.
 if exists(select 1 from public.candidate_placements a join public.candidate_placements b on a.job_id=b.job_id where a.candidate_id=$1 and b.candidate_id=$2) then raise exception 'MERGE_JOB_CONFLICT';end if;
 update public.candidate_placements set candidate_id=$2 where candidate_id=$1;
 -- Placement IDs stay unchanged, retaining interviews, notes, timestamps and history.
 -- Source contact data and source grants are retained for audit, not copied to the target.
 update public.candidates set merged_into=target where id=source;
 insert into public.merge_audit(organization_id,source_id,target_id,actor_id) values(s.organization_id,source,target,auth.uid());
end$$;
commit;
