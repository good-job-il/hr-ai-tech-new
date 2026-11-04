begin;
alter table public.jobs add column category text not null default '' check(length(category)<=120),add column work_mode text not null default 'onsite' check(work_mode in ('onsite','hybrid','remote')),add column experience_years integer check(experience_years between 0 and 60),add column salary_min integer check(salary_min>=0),add column salary_max integer check(salary_max>=0),add constraint salary_range check(salary_min is null or salary_max is null or salary_min<=salary_max);
grant update(title,location,description,type,category,work_mode,experience_years,salary_min,salary_max) on public.jobs to authenticated;
alter table public.applications drop constraint applications_status_check;
alter table public.applications add constraint applications_status_check check(status in ('submitted','reviewing','interview','offer','hired','rejected','withdrawn'));
create function public.withdraw_application(application uuid) returns void language plpgsql security definer set search_path='' as $$begin
 update public.applications set status='withdrawn' where id=application and candidate_id=auth.uid() and status not in ('hired','rejected','withdrawn');
 if not found then raise exception 'Not permitted';end if;end$$;
create function public.protect_withdrawn() returns trigger language plpgsql set search_path='' as $$begin
 if old.status='withdrawn' and new.status<>'withdrawn' then raise exception 'Candidate withdrew this application';end if;return new;end$$;
create trigger protect_withdrawn before update on public.applications for each row execute function public.protect_withdrawn();
create function public.remove_member(org uuid, member uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.has_role(org,array['owner']) or member=auth.uid() then raise exception 'Not permitted';end if;
 delete from public.memberships where organization_id=org and user_id=member;end$$;
drop policy membership_read on public.memberships;
create policy membership_read on public.memberships for select to authenticated using(user_id=auth.uid() or public.has_role(organization_id,array['owner','admin']));
create function public.update_candidate(candidate uuid,candidate_name text,candidate_email text,pool text) returns void language plpgsql security definer set search_path='' as $$declare c public.candidates;begin
 select * into strict c from public.candidates where id=candidate for update;
 if c.merged_into is not null or not public.has_role(c.organization_id,array['owner','admin','recruiter']) or (c.owner_id<>auth.uid() and not public.has_role(c.organization_id,array['owner','admin'])) then raise exception 'Not permitted';end if;
 if pool='personal' and not exists(select 1 from public.organizations where id=c.organization_id and kind='agency') then raise exception 'Personal pool is agency-only';end if;
 update public.candidates set full_name=trim(candidate_name),email=trim(candidate_email),visibility=pool where id=candidate;end$$;
revoke all on function public.withdraw_application(uuid),public.remove_member(uuid,uuid),public.update_candidate(uuid,text,text,text) from public,anon;
grant execute on function public.withdraw_application(uuid),public.remove_member(uuid,uuid),public.update_candidate(uuid,text,text,text) to authenticated;
commit;
