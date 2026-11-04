-- Imported content remains private until explicitly approved for publication.
begin;
alter table public.external_jobs add column publication_status text not null default 'draft' check(publication_status in ('draft','review','published'));
alter table public.external_jobs add column description text,add column responsibilities text,add column requirements text,add column benefits text;
drop policy external_jobs_read on public.external_jobs;
create policy external_jobs_read on public.external_jobs for select using(publication_status='published' and status='active' and verified_at<=now()+interval '5 minutes' and verified_at>now()-interval '7 days');
-- Source addresses are retained privately for verification, never delivered to public clients.
revoke select on public.external_jobs from anon,authenticated;
grant select(id,source_id,title,location,department,employment_type,status,verified_at,first_seen_at,publication_status,description,responsibilities,requirements,benefits) on public.external_jobs to anon,authenticated;
revoke select on public.job_sources from anon,authenticated;
grant select(id,company) on public.job_sources to anon,authenticated;
commit;
