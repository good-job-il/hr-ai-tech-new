begin;
alter function public.merge_candidates(uuid,uuid) rename to merge_candidates_before_interests;
revoke all on function public.merge_candidates_before_interests(uuid,uuid) from public,anon,authenticated;
create function public.merge_candidates(source uuid,target uuid) returns void language plpgsql security definer set search_path='' as $$declare aid uuid;copied jsonb;begin
 perform public.merge_candidates_before_interests(source,target);
 with added as(insert into public.candidate_interests(candidate_id,role_id,active,confirmed_at) select target,role_id,active,confirmed_at from public.candidate_interests where candidate_id=source on conflict(candidate_id,role_id) do nothing returning id) select coalesce(jsonb_agg(id),'[]'::jsonb) into copied from added;
 select id into strict aid from public.merge_audit where source_id=source and target_id=target and restored_at is null order by created_at desc,id desc limit 1;
 update public.merge_audit set snapshot=snapshot||jsonb_build_object('copied_interest_ids',copied,'interests_after',coalesce((select jsonb_agg(to_jsonb(i) order by id) from public.candidate_interests i where candidate_id in(source,target)),'[]'::jsonb)) where id=aid;
end$$;
alter function public.restore_candidate_merge(uuid) rename to restore_candidate_merge_before_interests;
revoke all on function public.restore_candidate_merge_before_interests(uuid) from public,anon,authenticated;
create function public.restore_candidate_merge(merge_id uuid) returns void language plpgsql security definer set search_path='' as $$declare a public.merge_audit;current_interests jsonb;begin
 select * into strict a from public.merge_audit where id=merge_id for update;
 if not public.org_capability(a.organization_id,'candidates.merge') then raise exception 'RESTORE_NOT_PERMITTED';end if;
 perform id from public.candidates where id in(a.source_id,a.target_id) order by id for update;
 if a.snapshot ? 'interests_after' then
 select coalesce(jsonb_agg(to_jsonb(i) order by id),'[]'::jsonb) into current_interests from public.candidate_interests i where candidate_id in(a.source_id,a.target_id);
 if current_interests is distinct from a.snapshot->'interests_after' then raise exception 'RESTORE_CONFLICT_INTEREST_CHANGED';end if;
 end if;
 perform public.restore_candidate_merge_before_interests(merge_id);
 delete from public.candidate_interests where id in(select value::uuid from jsonb_array_elements_text(coalesce(a.snapshot->'copied_interest_ids','[]'::jsonb)));
end$$;
alter function public.candidate_merge_review(uuid) rename to candidate_merge_review_before_interests;
revoke all on function public.candidate_merge_review_before_interests(uuid) from public,anon,authenticated;
create function public.candidate_merge_review(candidate uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare review jsonb;begin
 review:=public.candidate_merge_review_before_interests(candidate);
 return review||jsonb_build_object('interests',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('role',r.name,'domain',r.domain)) from public.candidate_interests i join public.career_roles r on r.id=i.role_id where candidate_id=candidate),'[]'::jsonb));
end$$;
revoke all on function public.merge_candidates(uuid,uuid),public.restore_candidate_merge(uuid),public.candidate_merge_review(uuid) from public,anon;
grant execute on function public.merge_candidates(uuid,uuid),public.restore_candidate_merge(uuid),public.candidate_merge_review(uuid) to authenticated;
commit;
