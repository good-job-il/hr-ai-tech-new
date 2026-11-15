begin;
-- Reconcile the permission hardening already deployed as cloud migration 059.
create or replace function public.can_read_org_document(path text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare doc public.candidate_documents;c public.candidates;
begin
 select * into doc from public.candidate_documents where object_path=path;
 if found then
  return (public.can_read_candidate(doc.candidate_id) and public.org_capability(doc.organization_id,'cv.download'))
   or exists(select 1 from public.client_presentations s where s.revoked_at is null
     and s.snapshot->>'document_id'=doc.id::text and public.has_client_portal(s.client_id));
 end if;
 select * into c from public.candidates where id::text=split_part(path,'/',2) and organization_id::text=split_part(path,'/',1);
 return found and public.can_read_candidate(c.id) and public.org_capability(c.organization_id,'cv.download');
end$$;

create function public.candidate_cv_download(path text) returns text
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from storage.objects o where o.bucket_id='candidate-cvs' and o.name=path)
 then raise exception 'Not permitted';end if;
 if split_part(path,'/',1)=auth.uid()::text or exists(
  select 1 from public.applications a left join public.jobs j on j.id=a.job_id
  where a.candidate_id::text=split_part(path,'/',1) and public.can_manage_application(a.id)
   and ((a.external_job_id is not null and public.is_platform_admin()) or public.org_capability(j.organization_id,'cv.download'))
 ) then return path;end if;
 raise exception 'Not permitted';
end$$;
revoke all on function public.candidate_cv_download(text) from public,anon;
grant execute on function public.candidate_cv_download(text) to authenticated;

-- CV bytes may only be served by the no-store server endpoint after a user-JWT
-- authorization RPC. Metadata listing remains available under the existing RLS.
-- Restrictive policy also blocks signing, S3 reads and newly added read policies.
create policy cv_server_delivery_only on storage.objects as restrictive for select to authenticated
using(bucket_id not in ('organization-cvs','candidate-cvs')
 or storage.allow_any_operation(array['object.list','object.list_v2']));

-- IMPORTANT: deploy only with SUPABASE_SECRET_KEY configured; purge legacy CV
-- bucket CDN caches and rotate legacy object paths before acceptance, preserving
-- bytes and document references. A cached or pre-issued signed URL bypasses RLS.
commit;
