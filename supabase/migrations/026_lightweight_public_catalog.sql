begin;
create view public.public_job_catalog with(security_invoker=true) as
 select j.id,false as external,null::text as source_id,j.title,j.location,j.type,left(j.description,280) as description,j.organization_id,o.name as company,j.category,j.work_mode,j.experience_years,j.salary_min,j.salary_max,j.created_at,null::timestamptz as verified_at,'{}'::jsonb as localized_content
 from public.jobs j join public.organizations o on o.id=j.organization_id where j.status='open'
 union all
 select e.id,true,e.source_id,e.title,e.location,coalesce(e.employment_type,'unspecified'),left(e.description,280),null::uuid,s.company,e.department,null::text,null::integer,null::numeric,null::numeric,e.first_seen_at,e.verified_at,case when e.localized_content='{}'::jsonb then '{}'::jsonb else jsonb_build_object('he',jsonb_build_object('title',e.localized_content#>>'{he,title}','description',left(e.localized_content#>>'{he,description}',280)),'en',jsonb_build_object('title',e.localized_content#>>'{en,title}','description',left(e.localized_content#>>'{en,description}',280))) end
 from public.external_jobs e join public.job_sources s on s.id=e.source_id where e.publication_status='published' and e.status='active' and e.verified_at<=now()+interval '5 minutes' and e.verified_at>now()-interval '7 days';
grant select on public.public_job_catalog to anon,authenticated;
create function public.search_public_job_ids(search text) returns table(id uuid,external boolean) language sql stable security invoker set search_path='' as $$
 select j.id,false from public.jobs j join public.organizations o on o.id=j.organization_id where j.status='open' and length(trim(search)) between 1 and 160 and (j.title||' '||j.description||' '||o.name||' '||coalesce(j.category,'')) ilike '%'||search||'%'
 union all
 select e.id,true from public.external_jobs e join public.job_sources s on s.id=e.source_id where e.status='active' and e.publication_status='published' and e.verified_at>now()-interval '7 days' and e.verified_at<=now()+interval '5 minutes' and length(trim(search)) between 1 and 160 and (e.title||' '||e.description||' '||s.company||' '||coalesce(e.department,'')) ilike '%'||search||'%';
$$;
revoke all on function public.search_public_job_ids(text) from public;grant execute on function public.search_public_job_ids(text) to anon,authenticated;
commit;
