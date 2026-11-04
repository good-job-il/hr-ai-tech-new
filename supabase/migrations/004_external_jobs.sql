-- Staging-only pilot: external vacancies are separate from tenant-owned jobs.
begin;
create table public.job_sources(id text primary key,company text not null,career_url text not null check(career_url like 'https://%'));
create table public.external_jobs(
 id uuid primary key default gen_random_uuid(),source_id text not null references public.job_sources,
 source_url text not null unique check(source_url like 'https://%'),title text not null check(length(trim(title)) between 1 and 240),
 location text not null check(length(trim(location)) between 1 and 240),department text,
 employment_type text check(employment_type in ('full-time','part-time','contract')),
 status text not null default 'active' check(status in ('active','closed')),
 verified_at timestamptz not null,first_seen_at timestamptz not null default now(),
 verification_method text not null check(verification_method in ('public-html','public-browser'))
);
create index external_jobs_source_idx on public.external_jobs(source_id);
alter table public.job_sources enable row level security;
alter table public.external_jobs enable row level security;
revoke all on public.job_sources,public.external_jobs from anon,authenticated;
grant select on public.job_sources,public.external_jobs to anon,authenticated;
create policy sources_read on public.job_sources for select using(true);
create policy external_jobs_read on public.external_jobs for select using(status='active' and verified_at<=now()+interval '5 minutes' and verified_at>now()-interval '7 days');
-- Public/tenant users have no import/update privilege. Import is a reviewed server/admin operation.
commit;
