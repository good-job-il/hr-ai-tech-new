begin;
alter table public.external_jobs add column localized_content jsonb not null default '{}';
grant select(localized_content) on public.external_jobs to anon,authenticated;
create function public.clean_job_text(value text) returns text language sql immutable set search_path='' as $$select trim(regexp_replace(coalesce(value,''),'https?://[^[:space:]]+|www[.][^[:space:]]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}','','gi'))$$;
create function public.save_external_draft(vacancy uuid,content jsonb) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.is_platform_admin() then raise exception 'Not permitted';end if;
 if octet_length(content::text)>160000 or length(trim(coalesce(content->>'title','')))=0 or length(trim(coalesce(content->>'location','')))=0 then raise exception 'Invalid job content';end if;
 update public.external_jobs set title=trim(content->>'title'),location=trim(content->>'location'),department=nullif(trim(content->>'department'),''),employment_type=nullif(content->>'employment_type',''),description=public.clean_job_text(content->>'description'),responsibilities=public.clean_job_text(content->>'responsibilities'),requirements=public.clean_job_text(content->>'requirements'),benefits=public.clean_job_text(content->>'benefits'),publication_status='draft',verified_at=null,verification_method=null,
 localized_content=jsonb_build_object('he',jsonb_build_object('title',public.clean_job_text(content->>'title_he'),'description',public.clean_job_text(content->>'description_he'),'responsibilities',public.clean_job_text(content->>'responsibilities_he'),'requirements',public.clean_job_text(content->>'requirements_he'),'benefits',public.clean_job_text(content->>'benefits_he'))) where id=vacancy;
 if not found then raise exception 'Job not found';end if;end$$;
revoke all on function public.save_external_draft(uuid,jsonb) from public,anon;grant execute on function public.save_external_draft(uuid,jsonb) to authenticated;
commit;
