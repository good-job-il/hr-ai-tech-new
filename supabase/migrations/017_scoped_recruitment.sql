begin;
alter table public.applications add column handler_id uuid references auth.users;
create index application_handler_idx on public.applications(handler_id);
create or replace function public.can_manage_application(app uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.applications a left join public.jobs j on j.id=a.job_id left join public.organizations o on o.id=j.organization_id where a.id=app and ((a.external_job_id is not null and public.is_platform_admin()) or (public.org_capability(j.organization_id,'candidates.write') and (o.kind='employer' or public.org_capability(j.organization_id,'candidates.all') or a.handler_id=auth.uid() or (public.org_capability(j.organization_id,'candidates.team') and public.manages_member(j.organization_id,a.handler_id))))))$$;
drop policy applications_read on public.applications;
create policy applications_read on public.applications for select to authenticated using(candidate_id=auth.uid() or public.can_manage_application(id));
create function public.assign_application(application uuid,handler uuid) returns void language plpgsql security definer set search_path='' as $$declare org uuid;old_handler uuid;begin
 select j.organization_id,a.handler_id into strict org,old_handler from public.applications a join public.jobs j on j.id=a.job_id where a.id=application for update of a;
 if not public.org_capability(org,'candidates.all') and not (public.org_capability(org,'candidates.team') and public.manages_member(org,old_handler) and public.manages_member(org,handler)) then raise exception 'Not permitted';end if;
 if not exists(select 1 from public.memberships m where m.organization_id=org and m.user_id=handler and m.status='active' and m.role in ('org_admin','recruitment_manager','team_lead','recruitment_coordinator','hr_manager','internal_coordinator')) then raise exception 'INVALID_HANDLER';end if;
 update public.applications set handler_id=handler where id=application;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(org,auth.uid(),'applications',application,'handler_change',jsonb_build_object('from',old_handler,'to',handler));
end$$;
drop policy profile_read on public.candidate_profiles;
drop policy platform_profile_read on public.candidate_profiles;
create policy profile_read on public.candidate_profiles for select to authenticated using(user_id=auth.uid() or exists(select 1 from public.applications a where a.candidate_id=user_id and public.can_manage_application(a.id)));
drop policy cv_read on storage.objects;drop policy platform_cv_read on storage.objects;
create policy cv_read on storage.objects for select to authenticated using(bucket_id='candidate-cvs' and ((storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public.applications a where a.candidate_id::text=(storage.foldername(name))[1] and public.can_manage_application(a.id))));
create or replace function public.can_manage_placement(placement uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.candidate_placements p where p.id=placement and public.org_capability(p.organization_id,'candidates.write') and public.can_read_candidate(p.candidate_id))$$;
alter table public.recruitment_tasks add column assigned_to uuid references auth.users;
create function public.can_read_task(task_org uuid,creator uuid,assignee uuid) returns boolean language sql stable security definer set search_path='' as $$select public.is_member(task_org) and (public.org_capability(task_org,'candidates.all') or creator=auth.uid() or assignee=auth.uid() or (public.org_capability(task_org,'candidates.team') and (public.manages_member(task_org,creator) or public.manages_member(task_org,assignee))))$$;
drop policy task_read on public.recruitment_tasks;drop policy task_update on public.recruitment_tasks;
create policy task_read on public.recruitment_tasks for select to authenticated using(public.can_read_task(organization_id,created_by,assigned_to));
create policy task_update on public.recruitment_tasks for update to authenticated using(public.org_capability(organization_id,'tasks.manage') and public.can_read_task(organization_id,created_by,assigned_to)) with check(public.org_capability(organization_id,'tasks.manage') and public.can_read_task(organization_id,created_by,assigned_to));
create function public.assign_task(task uuid,assignee uuid) returns void language plpgsql security definer set search_path='' as $$declare t public.recruitment_tasks;begin
 select * into strict t from public.recruitment_tasks where id=task for update;
 if not public.org_capability(t.organization_id,'candidates.all') and not (public.org_capability(t.organization_id,'candidates.team') and public.can_read_task(t.organization_id,t.created_by,t.assigned_to) and public.manages_member(t.organization_id,assignee)) then raise exception 'Not permitted';end if;
 if not exists(select 1 from public.memberships m where m.organization_id=t.organization_id and m.user_id=assignee and m.status='active') then raise exception 'INVALID_ASSIGNEE';end if;
 update public.recruitment_tasks set assigned_to=assignee where id=task;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(t.organization_id,auth.uid(),'recruitment_tasks',task,'task_assignment',jsonb_build_object('assignee',assignee));
end$$;
create table public.agency_clients(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,name text not null check(length(trim(name)) between 1 and 160),contact_name text not null default '' check(length(contact_name)<=160),contact_email text not null default '' check(length(contact_email)<=254),target_organization_id uuid references public.organizations,notes text not null default '' check(length(notes)<=4000),active boolean not null default true,created_at timestamptz not null default now());
alter table public.agency_clients enable row level security;
create policy client_read on public.agency_clients for select to authenticated using(public.has_role(organization_id,array['owner','admin','recruiter']));
create policy client_write on public.agency_clients for all to authenticated using(public.org_capability(organization_id,'jobs.manage')) with check(public.org_capability(organization_id,'jobs.manage') and exists(select 1 from public.organizations o where o.id=organization_id and o.kind='agency'));
revoke all on public.agency_clients from anon,authenticated;grant select,insert,update on public.agency_clients to authenticated;
alter table public.jobs add column client_id uuid references public.agency_clients;
grant update(client_id) on public.jobs to authenticated;
create function public.validate_job_client() returns trigger language plpgsql security definer set search_path='' as $$begin if new.client_id is not null and not exists(select 1 from public.agency_clients c where c.id=new.client_id and c.organization_id=new.organization_id and c.active) then raise exception 'INVALID_CLIENT';end if;return new;end$$;
create trigger valid_job_client before insert or update on public.jobs for each row execute function public.validate_job_client();
create table public.reward_entries(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,beneficiary_id uuid not null references auth.users,placement_id uuid references public.candidate_placements,amount numeric(12,2) not null check(amount>=0),currency text not null default 'ILS' check(currency in ('ILS','USD','EUR','GBP')),status text not null default 'pending' check(status in ('pending','approved','paid')),note text not null default '' check(length(note)<=2000),created_at timestamptz not null default now());
alter table public.reward_entries enable row level security;
create policy reward_entry_read on public.reward_entries for select to authenticated using(public.is_member(organization_id) and (beneficiary_id=auth.uid() or public.org_capability(organization_id,'organization.manage') or (public.org_capability(organization_id,'reports.read') and public.manages_member(organization_id,beneficiary_id))));
create policy reward_entry_write on public.reward_entries for all to authenticated using(public.org_capability(organization_id,'rewards.manage') and (public.org_capability(organization_id,'organization.manage') or beneficiary_id=auth.uid() or public.manages_member(organization_id,beneficiary_id))) with check(public.org_capability(organization_id,'rewards.manage') and (public.org_capability(organization_id,'organization.manage') or beneficiary_id=auth.uid() or public.manages_member(organization_id,beneficiary_id)) and exists(select 1 from public.memberships m where m.organization_id=reward_entries.organization_id and m.user_id=beneficiary_id) and (placement_id is null or exists(select 1 from public.candidate_placements p where p.id=placement_id and p.organization_id=reward_entries.organization_id)));
revoke all on public.reward_entries from anon,authenticated;grant select,insert on public.reward_entries to authenticated;grant update(amount,currency,status,note) on public.reward_entries to authenticated;
create function public.notify_scoped_application_event() returns trigger language plpgsql security definer set search_path='' as $$declare recipient uuid;app public.applications;begin
 if TG_TABLE_NAME='applications' then app=new;if TG_OP='INSERT' then
  if new.external_job_id is not null then for recipient in select user_id from public.platform_admins loop insert into public.notifications(user_id,application_id,kind) values(recipient,new.id,'new_application');end loop;
  else for recipient in select m.user_id from public.memberships m join public.jobs j on j.organization_id=m.organization_id join public.organizations o on o.id=j.organization_id where j.id=new.job_id and m.status='active' and (m.role in ('org_admin','recruitment_manager','hr_manager') or (o.kind='employer' and m.role='internal_coordinator')) loop insert into public.notifications(user_id,application_id,kind) values(recipient,new.id,'new_application');end loop;end if;
 elsif old.status<>new.status then insert into public.notifications(user_id,application_id,kind) values(new.candidate_id,new.id,'status_changed');end if;
 else select * into app from public.applications where id=new.application_id;insert into public.notifications(user_id,application_id,kind) values(app.candidate_id,app.id,'interview_scheduled');end if;return new;end$$;
drop trigger notify_application_event on public.applications;drop trigger notify_interview_event on public.interviews;
create trigger notify_application_event after insert or update on public.applications for each row execute function public.notify_scoped_application_event();
create trigger notify_interview_event after insert on public.interviews for each row execute function public.notify_scoped_application_event();
revoke all on function public.assign_application(uuid,uuid),public.can_read_task(uuid,uuid,uuid),public.assign_task(uuid,uuid) from public,anon;
grant execute on function public.assign_application(uuid,uuid),public.can_read_task(uuid,uuid,uuid),public.assign_task(uuid,uuid) to authenticated;

alter table public.candidates add column created_by uuid references auth.users;
update public.candidates set created_by=owner_id;
alter table public.candidates alter column created_by set not null,alter column created_by set default auth.uid();
create function public.preserve_candidate_creator() returns trigger language plpgsql security definer set search_path='' as $$begin if TG_OP='INSERT' and auth.uid() is not null then new.created_by:=auth.uid();elsif TG_OP='UPDATE' and new.created_by is distinct from old.created_by then raise exception 'Creator identity is immutable';end if;return new;end$$;
create trigger preserve_candidate_creator before insert or update on public.candidates for each row execute function public.preserve_candidate_creator();
create function public.transfer_candidate(candidate uuid,new_owner uuid) returns void language plpgsql security definer set search_path='' as $$declare c public.candidates;begin
 select * into strict c from public.candidates where id=candidate for update;
 if c.merged_into is not null or not public.org_capability(c.organization_id,'candidates.all') or not exists(select 1 from public.memberships m where m.organization_id=c.organization_id and m.user_id=new_owner and m.status='active' and m.role in ('org_admin','recruitment_manager','team_lead','recruitment_coordinator','hr_manager','internal_coordinator')) then raise exception 'Not permitted';end if;
 update public.candidates set owner_id=new_owner where id=candidate;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(c.organization_id,auth.uid(),'candidates',candidate,'owner_transfer',jsonb_build_object('from',c.owner_id,'to',new_owner));
end$$;
create function public.validate_task_assignee() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.assigned_to is not null then
 if not exists(select 1 from public.memberships m where m.organization_id=new.organization_id and m.user_id=new.assigned_to and m.status='active') then raise exception 'INVALID_ASSIGNEE';end if;
 if new.assigned_to<>auth.uid() and not public.org_capability(new.organization_id,'candidates.all') and not (public.org_capability(new.organization_id,'candidates.team') and public.manages_member(new.organization_id,new.assigned_to)) then raise exception 'Not permitted';end if;
 end if;return new;
end$$;
create trigger valid_task_assignee before insert or update of assigned_to on public.recruitment_tasks for each row execute function public.validate_task_assignee();
revoke all on function public.transfer_candidate(uuid,uuid) from public,anon;grant execute on function public.transfer_candidate(uuid,uuid) to authenticated;

commit;
