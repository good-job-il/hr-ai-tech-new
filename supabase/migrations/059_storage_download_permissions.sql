begin;
-- Storage endpoints and signed URL issuance must enforce the same capability as
-- candidate_document_download. A visible candidate is not a download grant.
create or replace function public.can_read_org_document(path text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare doc public.candidate_documents; c public.candidates;
begin
 select * into doc from public.candidate_documents where object_path=path;
 if found then
  return (public.can_read_candidate(doc.candidate_id)
          and public.org_capability(doc.organization_id,'cv.download'))
   or exists(select 1 from public.client_presentations s
     where s.revoked_at is null and s.snapshot->>'document_id'=doc.id::text
       and public.has_client_portal(s.client_id));
 end if;
 -- Uploads can exist before their metadata is attached; apply the same check.
 select * into c from public.candidates
  where id::text=split_part(path,'/',2) and organization_id::text=split_part(path,'/',1);
 return found and public.can_read_candidate(c.id)
  and public.org_capability(c.organization_id,'cv.download');
end$$;
-- Candidates retain access to their own uploads. Organization staff need both
-- application scope and an explicit download capability; platform applications
-- keep their existing platform-admin scope.
drop policy cv_read on storage.objects;
create policy cv_read on storage.objects for select to authenticated using(
 bucket_id='candidate-cvs' and (
  (storage.foldername(name))[1]=auth.uid()::text
  or exists(select 1 from public.applications a
    left join public.jobs j on j.id=a.job_id
    where a.candidate_id::text=(storage.foldername(name))[1]
      and public.can_manage_application(a.id)
      and ((a.external_job_id is not null and public.is_platform_admin())
        or public.org_capability(j.organization_id,'cv.download')))
 ));
commit;
