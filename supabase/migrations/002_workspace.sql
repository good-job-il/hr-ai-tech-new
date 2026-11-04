-- Apply after 001, ONLY in the isolated staging database.
begin;
alter table public.organizations add column kind text not null default 'employer' check(kind in ('employer','agency'));
alter table public.memberships add column role text not null default 'recruiter' check(role in ('owner','admin','recruiter','viewer','finance'));
-- Existing organizations were created by their sole initial member.
update public.memberships set role='owner';
create function public.has_role(org uuid, roles text[]) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships where organization_id=org and user_id=auth.uid() and role=any(roles))$$;
create or replace function public.owns_job(job uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.jobs j where j.id=job and public.has_role(j.organization_id,array['owner','admin','recruiter']))$$;
create or replace function public.create_organization(org_name text, org_kind text default 'employer') returns uuid language plpgsql security definer set search_path='' as $$declare org_id uuid;begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if exists(select 1 from public.memberships where user_id=auth.uid()) then raise exception 'An organization already exists'; end if;
 insert into public.organizations(name,kind) values(trim(org_name),org_kind) returning id into org_id;
 insert into public.memberships(organization_id,user_id,role) values(org_id,auth.uid(),'owner');return org_id;end$$;
drop function public.create_organization(text);
drop policy jobs_insert on public.jobs;
drop policy jobs_update on public.jobs;
create policy jobs_insert on public.jobs for insert to authenticated with check(public.has_role(organization_id,array['owner','admin','recruiter']));
create policy jobs_update on public.jobs for update to authenticated using(public.has_role(organization_id,array['owner','admin','recruiter'])) with check(public.has_role(organization_id,array['owner','admin','recruiter']));
create table public.candidate_profiles(user_id uuid primary key references auth.users on delete cascade,full_name text not null check(length(trim(full_name)) between 1 and 160),phone text not null default '' check(length(phone)<=40),headline text not null default '' check(length(headline)<=240));
create table public.candidates(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,owner_id uuid not null references auth.users,full_name text not null check(length(trim(full_name)) between 1 and 160),email text not null check(length(email)<=254 and email like '%@%'),email_key text generated always as(lower(trim(email))) stored,visibility text not null default 'personal' check(visibility in ('personal','shared')),merged_into uuid references public.candidates,created_at timestamptz not null default now(),unique(organization_id,email_key));
create table public.candidate_access(candidate_id uuid references public.candidates on delete cascade,user_id uuid references auth.users,primary key(candidate_id,user_id));
create table public.access_requests(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,email text not null check(length(email)<=254),requester_id uuid not null references auth.users,status text not null default 'pending' check(status in ('pending','approved','denied')),created_at timestamptz not null default now());
create unique index pending_request on public.access_requests(organization_id,lower(trim(email)),requester_id) where status='pending';
create function public.can_read_candidate(cid uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.candidates c where c.id=cid and c.merged_into is null and public.is_member(c.organization_id) and (c.owner_id=auth.uid() or c.visibility='shared' or public.has_role(c.organization_id,array['owner','admin']) or exists(select 1 from public.candidate_access a where a.candidate_id=c.id and a.user_id=auth.uid())))$$;
create table public.interviews(id uuid primary key default gen_random_uuid(),application_id uuid not null references public.applications,starts_at timestamptz not null,notes text not null default '' check(length(notes)<=4000),created_at timestamptz not null default now());
create table public.reward_policies(organization_id uuid primary key references public.organizations,policy text not null check(length(policy)<=8000),updated_at timestamptz not null default now());
create table public.merge_audit(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,source_id uuid not null references public.candidates,target_id uuid not null references public.candidates,actor_id uuid not null references auth.users,created_at timestamptz not null default now());
create function public.resolve_access(request_id uuid, approve boolean) returns void language plpgsql security definer set search_path='' as $$declare r public.access_requests; c public.candidates;begin
 select * into strict r from public.access_requests where id=request_id for update;
 select * into strict c from public.candidates where organization_id=r.organization_id and email_key=lower(trim(r.email)) and merged_into is null;
 if r.status<>'pending' or not public.has_role(r.organization_id,array['owner','admin']) then raise exception 'Not permitted';end if;
 if approve then insert into public.candidate_access values(c.id,r.requester_id) on conflict do nothing;end if;
 update public.access_requests set status=case when approve then 'approved' else 'denied' end where id=request_id;end$$;
create function public.merge_candidates(source uuid,target uuid) returns void language plpgsql security definer set search_path='' as $$declare s public.candidates;t public.candidates;begin
 if source=target then raise exception 'Choose distinct records';end if;
 -- Deterministic locking prevents cross-merge races.
 perform id from public.candidates where id in(source,target) order by id for update;
 select * into strict s from public.candidates where id=source;
 select * into strict t from public.candidates where id=target;
 if s.organization_id<>t.organization_id or s.merged_into is not null or t.merged_into is not null or not public.has_role(s.organization_id,array['owner','admin']) then raise exception 'Not permitted';end if;
 -- Retain source for audit; access to source never broadens target access.
 update public.candidates set merged_into=target where id=source;
 insert into public.merge_audit(organization_id,source_id,target_id,actor_id) values(s.organization_id,source,target,auth.uid());end$$;
create function public.set_member_role(org uuid, member uuid, new_role text) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.has_role(org,array['owner']) or member=auth.uid() or new_role='owner' then raise exception 'Not permitted';end if;
 insert into public.memberships(organization_id,user_id,role) values(org,member,new_role) on conflict(organization_id,user_id) do update set role=excluded.role;end$$;
alter table public.candidate_profiles enable row level security;
alter table public.candidates enable row level security;
alter table public.candidate_access enable row level security;
alter table public.access_requests enable row level security;
alter table public.interviews enable row level security;
alter table public.reward_policies enable row level security;
alter table public.merge_audit enable row level security;
create policy profile_read on public.candidate_profiles for select to authenticated using(user_id=auth.uid() or exists(select 1 from public.applications a where a.candidate_id=user_id and public.owns_job(a.job_id)));
create policy profile_insert on public.candidate_profiles for insert to authenticated with check(user_id=auth.uid());
create policy profile_update on public.candidate_profiles for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy candidate_read on public.candidates for select to authenticated using(merged_into is null and public.is_member(organization_id) and (owner_id=auth.uid() or visibility='shared' or public.has_role(organization_id,array['owner','admin']) or public.can_read_candidate(id)));
create policy candidate_insert on public.candidates for insert to authenticated with check(owner_id=auth.uid() and merged_into is null and public.has_role(organization_id,array['owner','admin','recruiter']) and (visibility='shared' or exists(select 1 from public.organizations o where o.id=organization_id and o.kind='agency')));
create policy access_read on public.candidate_access for select to authenticated using(user_id=auth.uid() or public.can_read_candidate(candidate_id));
create policy request_read on public.access_requests for select to authenticated using(requester_id=auth.uid() or public.has_role(organization_id,array['owner','admin']));
create policy request_insert on public.access_requests for insert to authenticated with check(requester_id=auth.uid() and status='pending' and public.has_role(organization_id,array['owner','admin','recruiter']));
create policy interview_read on public.interviews for select to authenticated using(exists(select 1 from public.applications a where a.id=application_id and (a.candidate_id=auth.uid() or public.owns_job(a.job_id))));
create policy interview_insert on public.interviews for insert to authenticated with check(exists(select 1 from public.applications a where a.id=application_id and public.owns_job(a.job_id)));
create policy reward_read on public.reward_policies for select to authenticated using(public.has_role(organization_id,array['owner','admin','finance']));
create policy reward_insert on public.reward_policies for insert to authenticated with check(public.has_role(organization_id,array['owner','admin']));
create policy reward_update on public.reward_policies for update to authenticated using(public.has_role(organization_id,array['owner','admin'])) with check(public.has_role(organization_id,array['owner','admin']));
create policy merge_read on public.merge_audit for select to authenticated using(public.has_role(organization_id,array['owner','admin']));
revoke all on public.candidate_profiles,public.candidates,public.candidate_access,public.access_requests,public.interviews,public.reward_policies,public.merge_audit from anon,authenticated;
grant select,insert,update on public.candidate_profiles to authenticated;
grant select,insert on public.candidates,public.access_requests,public.interviews to authenticated;
grant select on public.candidate_access,public.merge_audit to authenticated;
grant select,insert,update on public.reward_policies to authenticated;
revoke all on function public.has_role(uuid,text[]),public.can_read_candidate(uuid),public.resolve_access(uuid,boolean),public.merge_candidates(uuid,uuid),public.set_member_role(uuid,uuid,text),public.create_organization(text,text) from public,anon;
grant execute on function public.has_role(uuid,text[]),public.can_read_candidate(uuid),public.resolve_access(uuid,boolean),public.merge_candidates(uuid,uuid),public.set_member_role(uuid,uuid,text),public.create_organization(text,text) to authenticated;
-- Private CV bucket. Users cannot overwrite another candidate's file.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('candidate-cvs','candidate-cvs',false,5242880,array['application/pdf']) on conflict(id) do nothing;
create policy cv_insert on storage.objects for insert to authenticated with check(bucket_id='candidate-cvs' and (storage.foldername(name))[1]=auth.uid()::text);
create policy cv_read on storage.objects for select to authenticated using(bucket_id='candidate-cvs' and ((storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public.applications a where a.candidate_id::text=(storage.foldername(name))[1] and public.owns_job(a.job_id))));
commit;
