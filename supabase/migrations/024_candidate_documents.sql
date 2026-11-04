begin;
create table public.candidate_documents(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,candidate_id uuid not null references public.candidates,object_path text not null unique,label text not null check(length(trim(label)) between 1 and 240),uploaded_by uuid not null references auth.users,created_at timestamptz not null default now());
alter table public.candidate_documents enable row level security;
create policy candidate_document_read on public.candidate_documents for select to authenticated using(public.can_read_candidate(candidate_id));
create policy candidate_document_insert on public.candidate_documents for insert to authenticated with check(uploaded_by=auth.uid() and public.org_capability(organization_id,'candidates.write') and public.can_read_candidate(candidate_id) and exists(select 1 from public.candidates c where c.id=candidate_id and c.organization_id=candidate_documents.organization_id) and split_part(object_path,'/',1)=organization_id::text and split_part(object_path,'/',2)=candidate_id::text and object_path ~ '\.pdf$');
revoke all on public.candidate_documents from public,anon,authenticated;grant select,insert(organization_id,candidate_id,object_path,label,uploaded_by) on public.candidate_documents to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('organization-cvs','organization-cvs',false,5242880,array['application/pdf']);
create function public.can_read_org_document(path text) returns boolean language plpgsql stable security definer set search_path='' as $$declare doc public.candidate_documents;c public.candidates;begin
 select * into doc from public.candidate_documents where object_path=path;
 if found then return public.can_read_candidate(doc.candidate_id);end if;
 select * into c from public.candidates where id::text=split_part(path,'/',2) and organization_id::text=split_part(path,'/',1);
 return found and public.can_read_candidate(c.id);
end$$;
create policy org_document_read on storage.objects for select to authenticated using(bucket_id='organization-cvs' and public.can_read_org_document(name));
create policy org_document_upload on storage.objects for insert to authenticated with check(bucket_id='organization-cvs' and exists(select 1 from public.candidates c where c.id::text=split_part(name,'/',2) and c.organization_id::text=split_part(name,'/',1) and public.can_read_candidate(c.id) and public.org_capability(c.organization_id,'candidates.write')) and name ~ '\.pdf$');
create function public.candidate_document_download(document uuid) returns text language plpgsql security definer set search_path='' as $$declare d public.candidate_documents;begin
 select * into strict d from public.candidate_documents where id=document;
 if not public.can_read_candidate(d.candidate_id) or not public.org_capability(d.organization_id,'cv.download') then raise exception 'Not permitted';end if;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action) values(d.organization_id,auth.uid(),'candidate_documents',d.id,'document_download');return d.object_path;
end$$;
create trigger audit_candidate_documents after insert on public.candidate_documents for each row execute function public.audit_organization_record();
alter function public.merge_candidates(uuid,uuid) rename to merge_candidates_before_documents;
revoke all on function public.merge_candidates_before_documents(uuid,uuid) from public,anon,authenticated;
create function public.merge_candidates(source uuid,target uuid) returns void language plpgsql security definer set search_path='' as $$declare ids jsonb;aid uuid;begin
 perform id from public.candidates where id in(source,target) order by id for update;
 select coalesce(jsonb_agg(id order by id),'[]'::jsonb) into ids from public.candidate_documents where candidate_id=$1;
 perform public.merge_candidates_before_documents(source,target);
 update public.candidate_documents set candidate_id=$2 where candidate_id=$1;
 select id into strict aid from public.merge_audit where source_id=source and target_id=target and restored_at is null order by created_at desc,id desc limit 1;
 update public.merge_audit set snapshot=snapshot||jsonb_build_object('document_ids',ids,'documents_after',coalesce((select jsonb_agg(to_jsonb(d) order by d.id) from public.candidate_documents d where d.id in(select value::uuid from jsonb_array_elements_text(ids))),'[]'::jsonb)) where id=aid;
end$$;
alter function public.restore_candidate_merge(uuid) rename to restore_candidate_merge_before_documents;
revoke all on function public.restore_candidate_merge_before_documents(uuid) from public,anon,authenticated;
create function public.restore_candidate_merge(merge_id uuid) returns void language plpgsql security definer set search_path='' as $$declare a public.merge_audit;docs jsonb;begin
 select * into strict a from public.merge_audit where id=merge_id for update;
 if not public.org_capability(a.organization_id,'candidates.merge') then raise exception 'RESTORE_NOT_PERMITTED';end if;
 perform id from public.candidates where id in(a.source_id,a.target_id) order by id for update;
 perform id from public.candidate_documents where id in(select value::uuid from jsonb_array_elements_text(coalesce(a.snapshot->'document_ids','[]'::jsonb))) order by id for update;
 select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]'::jsonb) into docs from public.candidate_documents d where d.id in(select value::uuid from jsonb_array_elements_text(coalesce(a.snapshot->'document_ids','[]'::jsonb)));
 if docs is distinct from coalesce(a.snapshot->'documents_after','[]'::jsonb) then raise exception 'RESTORE_CONFLICT_DOCUMENT_CHANGED';end if;
 perform public.restore_candidate_merge_before_documents(merge_id);
 update public.candidate_documents set candidate_id=a.source_id where id in(select value::uuid from jsonb_array_elements_text(coalesce(a.snapshot->'document_ids','[]'::jsonb)));
end$$;
alter function public.candidate_merge_review(uuid) rename to candidate_merge_review_before_documents;
revoke all on function public.candidate_merge_review_before_documents(uuid) from public,anon,authenticated;
create function public.candidate_merge_review(candidate uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare review jsonb;begin
 review:=public.candidate_merge_review_before_documents(candidate);
 return review||jsonb_build_object('documents',coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at) from public.candidate_documents d where d.candidate_id=candidate),'[]'::jsonb));
end$$;
revoke all on function public.can_read_org_document(text),public.candidate_document_download(uuid),public.merge_candidates(uuid,uuid),public.restore_candidate_merge(uuid),public.candidate_merge_review(uuid) from public,anon;
grant execute on function public.can_read_org_document(text),public.candidate_document_download(uuid),public.merge_candidates(uuid,uuid),public.restore_candidate_merge(uuid),public.candidate_merge_review(uuid) to authenticated;
commit;
