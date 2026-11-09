-- Owner decision 2026-11-09: age of verification is evidence, not a closing event.
-- Preserve publication approval, active status, verified/non-future checks and RLS.
-- No job rows or verification timestamps are rewritten by this migration.
begin;

alter policy external_jobs_read on public.external_jobs
 using(publication_status='published' and status='active'
       and verified_at is not null and verified_at<=now()+interval '5 minutes');

create or replace view public.public_job_catalog with(security_invoker=true) as
 select j.id,false as external,null::text as source_id,j.title,j.location,j.type,left(j.description,280) as description,j.organization_id,o.name as company,j.category,j.work_mode,j.experience_years,j.salary_min,j.salary_max,j.created_at,null::timestamptz as verified_at,'{}'::jsonb as localized_content
 from public.jobs j join public.organizations o on o.id=j.organization_id where j.status='open' and j.is_public and not o.is_test
 union all
 select e.id,true,e.source_id,e.title,e.location,coalesce(e.employment_type,'unspecified'),left(e.description,280),null::uuid,s.company,e.department,null::text,null::integer,null::numeric,null::numeric,e.first_seen_at,e.verified_at,case when e.localized_content='{}'::jsonb then '{}'::jsonb else jsonb_build_object('he',jsonb_build_object('title',e.localized_content#>>'{he,title}','description',left(e.localized_content#>>'{he,description}',280)),'en',jsonb_build_object('title',e.localized_content#>>'{en,title}','description',left(e.localized_content#>>'{en,description}',280))) end
 from public.external_jobs e join public.job_sources s on s.id=e.source_id where e.publication_status='published' and e.status='active' and e.verified_at<=now()+interval '5 minutes';

create or replace function public.set_external_publication(vacancy uuid,publish boolean) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.is_platform_admin() then raise exception 'Not permitted';end if;
 update public.external_jobs set publication_status=case when publish then 'published' else 'draft' end where id=vacancy and (not publish or (status='active' and length(description)>0 and verified_at is not null and verified_at<=now()+interval '5 minutes'));
 if not found then raise exception 'Job unavailable or requires verification';end if;end$$;

create or replace function public.public_candidate_examples(job uuid,external boolean default false) returns table(display_name text,headline text) language sql stable security definer set search_path='' as $$
 select p.full_name,p.headline from public.candidate_profiles p join public.applications a on a.candidate_id=p.user_id where p.share_success_story and a.status='hired' and ((not external and a.job_id=job and exists(select 1 from public.jobs j where j.id=job and j.status='open')) or (external and a.external_job_id=job and exists(select 1 from public.external_jobs j where j.id=job and j.publication_status='published' and j.status='active' and j.verified_at is not null and j.verified_at<=now()+interval '5 minutes'))) order by a.created_at desc limit 3$$;

commit;
