begin;
alter table public.memberships drop constraint memberships_role_check;
alter table public.memberships add constraint memberships_role_check check(role in ('owner','admin','recruiter','viewer','finance','org_admin','recruitment_manager','team_lead','recruitment_coordinator','hr_manager','internal_coordinator'));
alter table public.memberships add column status text not null default 'active' check(status in ('active','suspended','closed')),add column manager_id uuid,add column approval_required boolean not null default true;
alter table public.memberships add constraint member_manager_fk foreign key(organization_id,manager_id) references public.memberships(organization_id,user_id);
create table public.member_permissions(organization_id uuid not null,user_id uuid not null,capability text not null check(capability in ('cv.download','candidates.export','rewards.manage')),granted_by uuid not null references auth.users,created_at timestamptz not null default now(),primary key(organization_id,user_id,capability),foreign key(organization_id,user_id) references public.memberships(organization_id,user_id));
alter table public.member_permissions enable row level security;
create or replace function public.is_member(org uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.memberships where organization_id=org and user_id=auth.uid() and status='active')$$;
create function public.normalized_role(org uuid,input_role text) returns text language sql stable security definer set search_path='' as $$select case input_role when 'owner' then 'org_admin' when 'admin' then case when o.kind='agency' then 'recruitment_manager' else 'hr_manager' end when 'recruiter' then case when o.kind='agency' then 'recruitment_coordinator' else 'internal_coordinator' end else input_role end from public.organizations o where o.id=org$$;
create or replace function public.has_role(org uuid,roles text[]) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.memberships m where m.organization_id=org and m.user_id=auth.uid() and m.status='active' and (m.role=any(roles) or (m.role='org_admin' and ('owner'=any(roles) or 'admin'=any(roles))) or (m.role in ('recruitment_manager','hr_manager') and 'admin'=any(roles)) or (m.role in ('team_lead','recruitment_coordinator','internal_coordinator') and 'recruiter'=any(roles))))$$;
create function public.manages_member(org uuid,member uuid) returns boolean language sql stable security definer set search_path='' as $$with recursive chain as (select m.user_id,m.manager_id,array[m.user_id] path from public.memberships m where m.organization_id=org and m.user_id=member union all select m.user_id,m.manager_id,c.path||m.user_id from public.memberships m join chain c on m.user_id=c.manager_id and m.organization_id=org where not m.user_id=any(c.path)) select public.is_member(org) and member<>auth.uid() and exists(select 1 from chain where manager_id=auth.uid())$$;
create function public.org_capability(org uuid,cap text) returns boolean language plpgsql stable security definer set search_path='' as $$declare r text;k text;begin
 select public.normalized_role(org,m.role),o.kind into r,k from public.memberships m join public.organizations o on o.id=m.organization_id where m.organization_id=org and m.user_id=auth.uid() and m.status='active';
 if r is null then return false;end if;
 if r='org_admin' then return cap=any(array['organization.manage','team.manage','team.configure','jobs.manage','candidates.all','candidates.team','candidates.write','candidates.merge','candidates.export','cv.download','approvals.manage','tasks.manage','reports.read','rewards.read','rewards.manage']);end if;
 if cap in ('cv.download','candidates.export','rewards.manage') then return exists(select 1 from public.member_permissions p where p.organization_id=org and p.user_id=auth.uid() and p.capability=cap);end if;
 if cap='rewards.read' then return (k='agency' and r='recruitment_manager') or r='finance' or exists(select 1 from public.member_permissions p where p.organization_id=org and p.user_id=auth.uid() and p.capability='rewards.manage');end if;
 if r in ('recruitment_manager','hr_manager') then return cap=any(array['team.manage','team.configure','jobs.manage','candidates.all','candidates.team','candidates.write','approvals.manage','tasks.manage','reports.read']) or (cap='candidates.merge' and r='recruitment_manager');end if;
 if r='team_lead' then return cap=any(array['team.configure','candidates.team','candidates.write','approvals.manage','tasks.manage','reports.read']);end if;
 return r in ('recruitment_coordinator','internal_coordinator') and cap=any(array['candidates.write','tasks.manage']);
end$$;
create function public.my_capabilities(org uuid) returns text[] language sql stable security definer set search_path='' as $$select coalesce(array_agg(c),'{}'::text[]) from unnest(array['organization.manage','team.manage','team.configure','jobs.manage','candidates.all','candidates.team','candidates.write','candidates.merge','candidates.export','cv.download','approvals.manage','tasks.manage','reports.read','rewards.read','rewards.manage']) c where public.org_capability(org,c)$$;
create function public.validate_membership_hierarchy() returns trigger language plpgsql security definer set search_path='' as $$declare kind text;parent_role text;begin
 select o.kind into strict kind from public.organizations o where o.id=new.organization_id;
 new.role:=public.normalized_role(new.organization_id,new.role);
 if (kind='agency' and new.role not in ('org_admin','recruitment_manager','team_lead','recruitment_coordinator','viewer','finance')) or (kind='employer' and new.role not in ('org_admin','hr_manager','internal_coordinator','viewer','finance')) then raise exception 'ROLE_NOT_VALID_FOR_ORGANIZATION';end if;
 if new.manager_id is not null then
  if new.manager_id=new.user_id then raise exception 'INVALID_MANAGER';end if;
  select public.normalized_role(new.organization_id,m.role) into parent_role from public.memberships m where m.organization_id=new.organization_id and m.user_id=new.manager_id and m.status='active';
  if parent_role is null or not ((new.role in ('recruitment_manager','hr_manager') and parent_role='org_admin') or (new.role='team_lead' and parent_role in ('org_admin','recruitment_manager')) or (new.role='recruitment_coordinator' and parent_role in ('org_admin','recruitment_manager','team_lead')) or (new.role='internal_coordinator' and parent_role in ('org_admin','hr_manager'))) then raise exception 'INVALID_MANAGER';end if;
 end if;return new;
end$$;
create trigger validate_member_hierarchy before insert or update on public.memberships for each row execute function public.validate_membership_hierarchy();
update public.memberships set role=public.normalized_role(organization_id,role);
create or replace function public.set_member_role(org uuid,member uuid,new_role text) returns void language plpgsql security definer set search_path='' as $$declare r text;begin
 r:=public.normalized_role(org,new_role);
 if member=auth.uid() or not public.org_capability(org,'team.manage') then raise exception 'Not permitted';end if;
 if not public.org_capability(org,'organization.manage') and (r not in ('team_lead','recruitment_coordinator','internal_coordinator') or exists(select 1 from public.memberships m where m.organization_id=org and m.user_id=member and (public.normalized_role(org,m.role) in ('org_admin','recruitment_manager','hr_manager') or m.status='closed'))) then raise exception 'Not permitted';end if;
 if exists(select 1 from public.memberships where organization_id=org and user_id=member and status='closed') then raise exception 'MEMBERSHIP_PERMANENTLY_CLOSED';end if;
 if exists(select 1 from public.memberships where organization_id=org and user_id=member and role='org_admin') and r<>'org_admin' and (select count(*) from public.memberships where organization_id=org and role='org_admin' and status='active')<=1 then raise exception 'LAST_ORGANIZATION_ADMIN';end if;
 insert into public.memberships(organization_id,user_id,role) values(org,member,r) on conflict(organization_id,user_id) do update set role=excluded.role,manager_id=null;
end$$;
create function public.configure_member(org uuid,member uuid,manager uuid,require_approval boolean) returns void language plpgsql security definer set search_path='' as $$begin
 if member=auth.uid() or not public.org_capability(org,'team.configure') or (not public.org_capability(org,'team.manage') and not public.manages_member(org,member)) then raise exception 'Not permitted';end if;
 if not public.org_capability(org,'team.manage') and manager is distinct from auth.uid() then raise exception 'Not permitted';end if;
 update public.memberships set manager_id=manager,approval_required=require_approval where organization_id=org and user_id=member and role not in ('org_admin','recruitment_manager','hr_manager') and status='active';if not found then raise exception 'Not permitted';end if;
end$$;
create function public.set_member_status(org uuid,member uuid,new_status text) returns void language plpgsql security definer set search_path='' as $$begin
 if member=auth.uid() or not public.org_capability(org,'organization.manage') or new_status not in ('active','suspended','closed') then raise exception 'Not permitted';end if;
 perform user_id from public.memberships where organization_id=org order by user_id for update;
 if exists(select 1 from public.memberships where organization_id=org and user_id=member and status='closed') then raise exception 'MEMBERSHIP_PERMANENTLY_CLOSED';end if;
 if exists(select 1 from public.memberships where organization_id=org and user_id=member and role='org_admin') and new_status<>'active' and (select count(*) from public.memberships where organization_id=org and role='org_admin' and status='active')<=1 then raise exception 'LAST_ORGANIZATION_ADMIN';end if;
 update public.memberships set status=new_status where organization_id=org and user_id=member;if not found then raise exception 'Not permitted';end if;
 if new_status='closed' then update public.candidates set visibility='shared' where organization_id=org and owner_id=member and visibility='personal' and merged_into is null;end if;
end$$;
create or replace function public.remove_member(org uuid,member uuid) returns void language plpgsql security definer set search_path='' as $$begin perform public.set_member_status(org,member,'suspended');end$$;
create function public.set_member_permission(org uuid,member uuid,cap text,enabled boolean) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.org_capability(org,'organization.manage') or not exists(select 1 from public.memberships where organization_id=org and user_id=member and status='active') then raise exception 'Not permitted';end if;
 if enabled then insert into public.member_permissions(organization_id,user_id,capability,granted_by) values(org,member,cap,auth.uid()) on conflict do nothing;else delete from public.member_permissions where organization_id=org and user_id=member and capability=cap;end if;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(org,auth.uid(),'member_permissions',member,'permission_change',jsonb_build_object('capability',cap,'enabled',enabled));
end$$;
create policy permission_read on public.member_permissions for select to authenticated using((user_id=auth.uid() and public.is_member(organization_id)) or public.org_capability(organization_id,'organization.manage'));
revoke all on public.member_permissions from anon,authenticated;grant select on public.member_permissions to authenticated;
drop policy membership_read on public.memberships;
create policy membership_read on public.memberships for select to authenticated using(user_id=auth.uid() or public.org_capability(organization_id,'team.manage') or (public.org_capability(organization_id,'team.configure') and public.manages_member(organization_id,user_id)));
drop policy reward_read on public.reward_policies;drop policy reward_insert on public.reward_policies;drop policy reward_update on public.reward_policies;
create policy reward_read on public.reward_policies for select to authenticated using(public.org_capability(organization_id,'rewards.read'));
create policy reward_insert on public.reward_policies for insert to authenticated with check(public.org_capability(organization_id,'rewards.manage'));
create policy reward_update on public.reward_policies for update to authenticated using(public.org_capability(organization_id,'rewards.manage')) with check(public.org_capability(organization_id,'rewards.manage'));
create or replace function public.can_read_candidate(cid uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.candidates c where c.id=cid and c.merged_into is null and public.is_member(c.organization_id) and (c.owner_id=auth.uid() or c.visibility='shared' or public.org_capability(c.organization_id,'candidates.all') or (public.org_capability(c.organization_id,'candidates.team') and public.manages_member(c.organization_id,c.owner_id)) or exists(select 1 from public.candidate_access a where a.candidate_id=c.id and a.user_id=auth.uid())))$$;
drop policy candidate_read on public.candidates;create policy candidate_read on public.candidates for select to authenticated using(merged_into is null and public.is_member(organization_id) and (owner_id=auth.uid() or visibility='shared' or public.org_capability(organization_id,'candidates.all') or (public.org_capability(organization_id,'candidates.team') and public.manages_member(organization_id,owner_id)) or exists(select 1 from public.candidate_access a where a.candidate_id=candidates.id and a.user_id=auth.uid())));
drop policy jobs_insert on public.jobs;drop policy jobs_update on public.jobs;
create policy jobs_insert on public.jobs for insert to authenticated with check(public.org_capability(organization_id,'jobs.manage'));
create policy jobs_update on public.jobs for update to authenticated using(public.org_capability(organization_id,'jobs.manage')) with check(public.org_capability(organization_id,'jobs.manage'));
-- Fine-grained functions are authenticated-only; helper ACLs remain explicit.
revoke all on function public.normalized_role(uuid,text),public.manages_member(uuid,uuid),public.org_capability(uuid,text),public.my_capabilities(uuid),public.configure_member(uuid,uuid,uuid,boolean),public.set_member_status(uuid,uuid,text),public.set_member_permission(uuid,uuid,text,boolean) from public,anon;
grant execute on function public.manages_member(uuid,uuid),public.org_capability(uuid,text),public.my_capabilities(uuid),public.configure_member(uuid,uuid,uuid,boolean),public.set_member_status(uuid,uuid,text),public.set_member_permission(uuid,uuid,text,boolean) to authenticated;
create or replace function public.merge_candidates(source uuid,target uuid) returns void language plpgsql security definer set search_path='' as $$
declare s public.candidates; t public.candidates;
begin
 if source=target then raise exception 'Choose distinct records';end if;
 perform id from public.candidates where id in(source,target) order by id for update;
 select * into strict s from public.candidates where id=source;
 select * into strict t from public.candidates where id=target;
 if s.organization_id<>t.organization_id or s.merged_into is not null or t.merged_into is not null or not public.org_capability(s.organization_id,'candidates.merge') then raise exception 'Not permitted';end if;
 -- Merging never exposes private placement notes to a wider candidate pool.
 if s.visibility<>t.visibility or (s.visibility='personal' and s.owner_id<>t.owner_id) then raise exception 'MERGE_POOL_MISMATCH';end if;
 perform id from public.candidate_placements where candidate_id in($1,$2) order by id for update;
 -- Conflicting processes may have different stages and interviews. Keep both untouched.
 if exists(select 1 from public.candidate_placements a join public.candidate_placements b on a.job_id=b.job_id where a.candidate_id=$1 and b.candidate_id=$2) then raise exception 'MERGE_JOB_CONFLICT';end if;
 update public.candidate_placements set candidate_id=$2 where candidate_id=$1;
 -- Placement IDs stay unchanged, retaining interviews, notes, timestamps and history.
 -- Source contact data and source grants are retained for audit, not copied to the target.
 update public.candidates set merged_into=target where id=source;
 insert into public.merge_audit(organization_id,source_id,target_id,actor_id) values(s.organization_id,source,target,auth.uid());
end$$;
create or replace function public.log_management_change() returns trigger language plpgsql security definer set search_path='' as $$declare org uuid;entity uuid;info jsonb;begin
 if TG_TABLE_NAME='jobs' then org=new.organization_id;entity=new.id;info=jsonb_build_object('title',new.title,'status',new.status);
 elsif TG_TABLE_NAME='external_jobs' then entity=new.id;info=jsonb_build_object('title',new.title,'publication_status',new.publication_status,'source',new.source_id);
 elsif TG_TABLE_NAME='memberships' then org=new.organization_id;entity=new.user_id;info=jsonb_build_object('role',new.role,'status',new.status,'manager_id',new.manager_id,'approval_required',new.approval_required);
 elsif TG_TABLE_NAME='candidate_placements' then org=new.organization_id;entity=new.id;info=jsonb_build_object('status',new.status);
 end if;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(org,auth.uid(),TG_TABLE_NAME,entity,lower(TG_OP),info);return new;end$$;

create function public.team_directory(org uuid) returns table(user_id uuid,role text,status text,manager_id uuid,approval_required boolean,display_name text) language sql stable security definer set search_path='' as $$select m.user_id,m.role,m.status,m.manager_id,m.approval_required,coalesce(nullif(p.full_name,''),u.email,m.user_id::text) from public.memberships m join auth.users u on u.id=m.user_id left join public.candidate_profiles p on p.user_id=m.user_id where m.organization_id=org and public.is_member(org) and (m.user_id=auth.uid() or public.org_capability(org,'team.manage') or (public.org_capability(org,'team.configure') and public.manages_member(org,m.user_id))) order by m.role,m.user_id$$;
revoke all on function public.team_directory(uuid) from public,anon;grant execute on function public.team_directory(uuid) to authenticated;

commit;
