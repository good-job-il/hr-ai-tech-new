-- Owner rule: eight public vacancies with the fewest submitted applications.
-- No personal data/counts are returned. CV migration 061 is a separate release.
begin;
create index if not exists applications_job_count_idx on public.applications(job_id) where job_id is not null;
create index if not exists applications_external_count_idx on public.applications(external_job_id) where external_job_id is not null;
create function public.public_featured_job_ids() returns table(id uuid,external boolean)
language sql stable security definer set search_path='' as $$
 select c.id,c.external from public.public_job_catalog c
 order by (select count(*) from public.applications a
  where (c.external and a.external_job_id=c.id) or (not c.external and a.job_id=c.id)) asc,
  coalesce(c.verified_at,c.created_at) desc nulls last,c.external,c.id
 limit 8
$$;
revoke all on function public.public_featured_job_ids() from public;
grant execute on function public.public_featured_job_ids() to anon,authenticated;
commit;
