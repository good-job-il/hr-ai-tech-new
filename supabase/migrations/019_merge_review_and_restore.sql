begin;
alter table public.merge_audit add column snapshot jsonb,add column restored_at timestamptz,add column restored_by uuid references auth.users;
alter function public.merge_candidates(uuid,uuid) rename to merge_candidates_preserving_records;
revoke all on function public.merge_candidates_preserving_records(uuid,uuid) from public,anon,authenticated;
create function public.merge_candidates(source uuid,target uuid) returns void language plpgsql security definer set search_path='' as $$
declare snap jsonb; aid uuid;
begin
 perform id from public.candidates where id in(source,target) order by id for update;
 snap:=jsonb_build_object('source',(select to_jsonb(c) from public.candidates c where id=source),'target',(select to_jsonb(c) from public.candidates c where id=target),'placement_ids',coalesce((select jsonb_agg(id order by id) from public.candidate_placements where candidate_id=$1),'[]'::jsonb));
 perform public.merge_candidates_preserving_records(source,target);
 select id into strict aid from public.merge_audit where source_id=source and target_id=target order by created_at desc,id desc limit 1;
 snap:=snap||jsonb_build_object('placements_after',coalesce((select jsonb_agg(to_jsonb(p) order by p.id) from public.candidate_placements p where p.id in(select value::text::uuid from jsonb_array_elements_text(snap->'placement_ids'))),'[]'::jsonb));
 update public.merge_audit set snapshot=snap where id=aid;
end$$;
create function public.restore_candidate_merge(merge_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare a public.merge_audit;s public.candidates;t public.candidates;current_placements jsonb;
begin
 select * into strict a from public.merge_audit where id=merge_id for update;
 if not public.org_capability(a.organization_id,'candidates.merge') or a.snapshot is null or a.restored_at is not null then raise exception 'RESTORE_NOT_PERMITTED';end if;
 perform id from public.candidates where id in(a.source_id,a.target_id) order by id for update;
 select * into strict s from public.candidates where id=a.source_id;select * into strict t from public.candidates where id=a.target_id;
 if s.merged_into is distinct from a.target_id or t.merged_into is not null or (to_jsonb(s)-'merged_into') is distinct from ((a.snapshot->'source')-'merged_into') or to_jsonb(t) is distinct from a.snapshot->'target' then raise exception 'RESTORE_CONFLICT_RECORD_CHANGED';end if;
 perform id from public.candidate_placements where id in(select value::uuid from jsonb_array_elements_text(a.snapshot->'placement_ids')) order by id for update;
 select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) into current_placements from public.candidate_placements p where p.id in(select value::uuid from jsonb_array_elements_text(a.snapshot->'placement_ids'));
 if current_placements is distinct from a.snapshot->'placements_after' then raise exception 'RESTORE_CONFLICT_PROCESS_CHANGED';end if;
 update public.candidate_placements set candidate_id=a.source_id where id in(select value::uuid from jsonb_array_elements_text(a.snapshot->'placement_ids'));
 update public.candidates set merged_into=null where id=a.source_id;
 update public.merge_audit set restored_at=now(),restored_by=auth.uid() where id=a.id;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(a.organization_id,auth.uid(),'merge_audit',a.id,'merge_restore',jsonb_build_object('source',a.source_id,'target',a.target_id));
end$$;
create function public.candidate_merge_review(candidate uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.candidates;begin
 select * into strict c from public.candidates where id=candidate;
 if not public.org_capability(c.organization_id,'candidates.merge') then raise exception 'Not permitted';end if;
 return jsonb_build_object('candidate',to_jsonb(c),'placements',coalesce((select jsonb_agg(jsonb_build_object('record',to_jsonb(p),'job_title',j.title,'history',(select coalesce(jsonb_agg(to_jsonb(h) order by h.created_at),'[]'::jsonb) from public.placement_activity h where h.placement_id=p.id),'interviews',(select coalesce(jsonb_agg(to_jsonb(i) order by i.starts_at),'[]'::jsonb) from public.placement_interviews i where i.placement_id=p.id))) from public.candidate_placements p join public.jobs j on j.id=p.job_id where p.candidate_id=c.id),'[]'::jsonb));
end$$;
revoke all on function public.merge_candidates(uuid,uuid),public.restore_candidate_merge(uuid),public.candidate_merge_review(uuid) from public,anon;
grant execute on function public.merge_candidates(uuid,uuid),public.restore_candidate_merge(uuid),public.candidate_merge_review(uuid) to authenticated;
commit;
