begin;
alter table public.candidates add constraint candidate_email_format check(trim(email) ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');
alter table public.candidate_profiles add constraint profile_phone_format check(trim(phone)='' or public.normalize_candidate_phone(phone) is not null);
create or replace function public.restore_candidate_merge(merge_id uuid) returns void language plpgsql security definer set search_path='' as $$declare a public.merge_audit;docs jsonb;begin
 select * into strict a from public.merge_audit where id=merge_id for update;
 if not public.org_capability(a.organization_id,'candidates.merge') then raise exception 'RESTORE_NOT_PERMITTED';end if;
 perform id from public.candidates where id in(a.source_id,a.target_id) order by id for update;
 perform id from public.candidate_documents where id in(select value::uuid from jsonb_array_elements_text(coalesce(a.snapshot->'document_ids','[]'::jsonb))) order by id for update;
 select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]'::jsonb) into docs from public.candidate_documents d where d.id in(select value::uuid from jsonb_array_elements_text(coalesce(a.snapshot->'document_ids','[]'::jsonb)));
 if docs is distinct from coalesce(a.snapshot->'documents_after','[]'::jsonb) then raise exception 'RESTORE_CONFLICT_DOCUMENT_CHANGED';end if;
 perform public.restore_candidate_merge_before_documents(merge_id);
 update public.candidate_documents set candidate_id=a.source_id where id in(select value::uuid from jsonb_array_elements_text(coalesce(a.snapshot->'document_ids','[]'::jsonb)));
end$$;

commit;
