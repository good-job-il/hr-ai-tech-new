begin;
create or replace function public.platform_overview() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not public.is_platform_admin() then raise exception 'Not permitted';end if;
 return jsonb_build_object('organizations',(select count(*) from public.organizations where not is_test),'candidates',(select count(*) from public.candidate_profiles),'jobs',(select count(*) from public.jobs j join public.organizations o on o.id=j.organization_id where j.status='open' and not o.is_test),'imported',(select count(*) from public.public_job_catalog where external),'applications',(select count(*) from public.applications a left join public.jobs j on j.id=a.job_id left join public.organizations o on o.id=j.organization_id where a.external_job_id is not null or not coalesce(o.is_test,false)),'imports',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (select s.company,count(e.id) jobs,max(e.verified_at) checked_at from public.job_sources s left join public.external_jobs e on e.source_id=s.id group by s.company)x));
end$$;
create function public.platform_metric_detail(metric text) returns table(label text,total bigint) language plpgsql stable security definer set search_path='' as $$begin
 if not public.is_platform_admin() then raise exception 'Not permitted';end if;
 if metric='organizations' then return query select o.name,1::bigint from public.organizations o where not o.is_test order by o.name;
 elsif metric='organization_records' then return query select o.name,count(c.id) from public.organizations o left join public.candidates c on c.organization_id=o.id and c.merged_into is null where not o.is_test group by o.id,o.name order by o.name;
 elsif metric='jobs' then return query select o.name,count(j.id) from public.organizations o join public.jobs j on j.organization_id=o.id and j.status='open' where not o.is_test group by o.id,o.name order by o.name;
 elsif metric='imported' then return query select coalesce(c.category,'Uncategorized'),count(*) from public.public_job_catalog c where c.external group by c.category order by count(*) desc;
 elsif metric='applications' then return query select a.status,count(*) from public.applications a left join public.jobs j on j.id=a.job_id left join public.organizations o on o.id=j.organization_id where a.external_job_id is not null or not coalesce(o.is_test,false) group by a.status;
 elsif metric='candidates' then return query select 'with_skills'::text,count(*) from public.candidate_profiles where length(trim(coalesce(skills,'')))>0 union all select 'without_skills'::text,count(*) from public.candidate_profiles where length(trim(coalesce(skills,'')))=0;
 elsif metric in ('registered_candidate_accounts','unique_emails') then return query select key,value::bigint from jsonb_each_text(public.candidate_population());
 else raise exception 'Unknown metric';end if;
end$$;
revoke all on function public.platform_metric_detail(text) from public,anon;
grant execute on function public.platform_metric_detail(text) to authenticated;
commit;
