begin;
create table public.team_invites(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,email text not null check(length(email)<=254),role text not null,manager_id uuid references auth.users,token_hash bytea not null unique,status text not null default 'pending' check(status in ('pending','accepted','revoked')),created_by uuid not null references auth.users,accepted_by uuid references auth.users,expires_at timestamptz not null default now()+interval '7 days',created_at timestamptz not null default now());
alter table public.team_invites enable row level security;
create policy invite_read on public.team_invites for select to authenticated using(public.is_member(organization_id) and (public.org_capability(organization_id,'organization.manage') or (created_by=auth.uid() and public.org_capability(organization_id,'team.manage'))));
revoke all on public.team_invites from anon,authenticated;grant select(id,organization_id,email,role,manager_id,status,created_by,expires_at,created_at) on public.team_invites to authenticated;
create function public.create_team_invite(org uuid,recipient_email text,requested_role text,manager uuid default null) returns text language plpgsql security definer set search_path='' as $$declare r text;k text;token text;begin
 if not public.org_capability(org,'team.manage') then raise exception 'Not permitted';end if;
 r:=public.normalized_role(org,requested_role);select kind into strict k from public.organizations where id=org;
 if (k='agency' and r not in ('org_admin','recruitment_manager','team_lead','recruitment_coordinator')) or (k='employer' and r not in ('org_admin','hr_manager','internal_coordinator')) then raise exception 'ROLE_NOT_VALID_FOR_ORGANIZATION';end if;
 if not public.org_capability(org,'organization.manage') and r not in ('team_lead','recruitment_coordinator','internal_coordinator') then raise exception 'Not permitted';end if;
 if recipient_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'INVALID_EMAIL';end if;
 if manager is not null and not exists(select 1 from public.memberships m where m.organization_id=org and m.user_id=manager and m.status='active' and m.role in ('org_admin','recruitment_manager','team_lead','hr_manager')) then raise exception 'INVALID_MANAGER';end if;
 perform pg_advisory_xact_lock(hashtextextended(org::text||lower(trim(recipient_email)),0));
 update public.team_invites set status='revoked' where organization_id=org and lower(email)=lower(trim(recipient_email)) and status='pending';
 token:=gen_random_uuid()::text||gen_random_uuid()::text;
 insert into public.team_invites(organization_id,email,role,manager_id,token_hash,created_by) values(org,lower(trim(recipient_email)),r,manager,sha256(convert_to(token,'UTF8')),auth.uid());
 insert into public.management_audit(organization_id,actor_id,entity_type,action,details) values(org,auth.uid(),'team_invites','invite_created',jsonb_build_object('role',r));return token;
end$$;
create function public.accept_team_invite(invite_token text) returns uuid language plpgsql security definer set search_path='' as $$declare invitation public.team_invites;email text;creator_role text;begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select u.email into email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
 select * into strict invitation from public.team_invites where token_hash=sha256(convert_to(invite_token,'UTF8')) for update;
 if email is null or lower(email)<>invitation.email or invitation.status<>'pending' or invitation.expires_at<=now() then raise exception 'INVITATION_UNAVAILABLE';end if;
 select m.role into creator_role from public.memberships m where m.organization_id=invitation.organization_id and m.user_id=invitation.created_by and m.status='active';
 if creator_role not in ('org_admin','recruitment_manager','hr_manager') or creator_role is null or (creator_role<>'org_admin' and invitation.role not in ('team_lead','recruitment_coordinator','internal_coordinator')) then raise exception 'INVITATION_UNAVAILABLE';end if;
 if exists(select 1 from public.memberships where organization_id=invitation.organization_id and user_id=auth.uid()) then raise exception 'ALREADY_OR_PREVIOUSLY_MEMBER';end if;
 insert into public.memberships(organization_id,user_id,role,manager_id) values(invitation.organization_id,auth.uid(),invitation.role,invitation.manager_id);
 update public.team_invites set status='accepted',accepted_by=auth.uid() where id=invitation.id;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action) values(invitation.organization_id,auth.uid(),'team_invites',invitation.id,'invite_accepted');return invitation.organization_id;
end$$;
create function public.revoke_team_invite(invitation_id uuid) returns void language plpgsql security definer set search_path='' as $$declare invitation public.team_invites;begin
 select * into strict invitation from public.team_invites where id=invitation_id for update;
 if not public.org_capability(invitation.organization_id,'organization.manage') and not (invitation.created_by=auth.uid() and public.org_capability(invitation.organization_id,'team.manage')) then raise exception 'Not permitted';end if;
 update public.team_invites set status='revoked' where id=invitation_id and status='pending';
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action) values(invitation.organization_id,auth.uid(),'team_invites',invitation_id,'invite_revoked');
end$$;
create function public.update_organization(org uuid,organization_name text) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.org_capability(org,'organization.manage') then raise exception 'Not permitted';end if;
 update public.organizations set name=trim(organization_name) where id=org;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action) values(org,auth.uid(),'organizations',org,'organization_updated');
end$$;
revoke all on function public.create_team_invite(uuid,text,text,uuid),public.accept_team_invite(text),public.revoke_team_invite(uuid),public.update_organization(uuid,text) from public,anon;
grant execute on function public.create_team_invite(uuid,text,text,uuid),public.accept_team_invite(text),public.revoke_team_invite(uuid),public.update_organization(uuid,text) to authenticated;
commit;
