begin;
-- A link joins workspaces. Presentations, feedback, placements and fee terms keep their original IDs.
create table public.client_organization_links(
 id uuid primary key default gen_random_uuid(),
 client_id uuid not null references public.agency_clients,
 employer_id uuid not null references public.organizations,
 requested_by uuid not null references auth.users,
 status text not null default 'pending' check(status in('pending','active','rejected','ended')),
 requested_at timestamptz not null default now(),
 decided_by uuid references auth.users,
 decided_at timestamptz,
 unique(client_id,employer_id)
);
create unique index client_one_live_link on public.client_organization_links(client_id) where status in('pending','active');
alter table public.client_organization_links enable row level security;
revoke all on public.client_organization_links from public,anon,authenticated;

create function public.portal_transition_options() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('organizations',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name)) from public.organizations o where o.kind='employer' and public.org_capability(o.id,'organization.manage')),'[]'::jsonb),'clients',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'agency',o.name,'link',(select jsonb_build_object('id',l.id,'status',l.status,'employer_name',e.name) from public.client_organization_links l join public.organizations e on e.id=l.employer_id where l.client_id=c.id order by l.requested_at desc limit 1))) from public.agency_clients c join public.organizations o on o.id=c.organization_id where public.has_client_portal(c.id)),'[]'::jsonb))
$$;

create function public.request_portal_organization_link(client uuid,employer uuid default null,new_name text default '',phone text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare c public.agency_clients;l public.client_organization_links;target uuid:=employer;result uuid;
begin
 select * into strict c from public.agency_clients where id=client for update;
 if not public.has_client_portal(client) or public.is_member(c.organization_id) or not exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null) then raise exception 'NOT_PERMITTED';end if;
 if c.target_organization_id is not null or exists(select 1 from public.client_organization_links x where x.client_id=client and x.status in('pending','active')) then raise exception 'LINK_ALREADY_EXISTS';end if;
 if target is null then
  if length(trim(new_name)) not between 1 and 160 or not public.valid_account_phone(phone) then raise exception 'INVALID_ORGANIZATION_CONTACT';end if;
  target:=public.create_organization_with_contact(trim(new_name),'employer',phone);
 end if;
 if not exists(select 1 from public.organizations o where o.id=target and o.kind='employer') or not public.org_capability(target,'organization.manage') or target=c.organization_id then raise exception 'NOT_PERMITTED';end if;
 insert into public.client_organization_links(client_id,employer_id,requested_by) values(client,target,auth.uid()) on conflict(client_id,employer_id) do update set status='pending',requested_by=auth.uid(),requested_at=now(),decided_by=null,decided_at=null returning id into result;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(c.organization_id,auth.uid(),'agency_clients',client,'organization_link_requested',jsonb_build_object('link_id',result,'employer_id',target));
 return result;
end$$;

create function public.agency_client_link_state(client uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare org uuid;begin
 select organization_id into strict org from public.agency_clients where id=client;
 if not public.org_capability(org,'organization.manage') then raise exception 'NOT_PERMITTED';end if;
 return coalesce((select jsonb_build_object('id',l.id,'status',l.status,'employer_name',o.name,'requested_at',l.requested_at) from public.client_organization_links l join public.organizations o on o.id=l.employer_id where l.client_id=client order by l.requested_at desc limit 1),'null'::jsonb);
end$$;

create function public.decide_portal_organization_link(link uuid,approve boolean) returns void language plpgsql security definer set search_path='' as $$
declare l public.client_organization_links;c public.agency_clients;begin
 select c0.* into strict c from public.agency_clients c0 join public.client_organization_links l0 on l0.client_id=c0.id where l0.id=link for update of c0;
 select * into strict l from public.client_organization_links where id=link for update;
 if not public.org_capability(c.organization_id,'organization.manage') or l.requested_by=auth.uid() or l.status<>'pending' or not c.active then raise exception 'NOT_PERMITTED';end if;
 if approve and (not exists(select 1 from public.client_portal_members m where m.client_id=c.id and m.user_id=l.requested_by and m.active) or not exists(select 1 from public.memberships m where m.organization_id=l.employer_id and m.user_id=l.requested_by and m.status='active' and public.normalized_role(m.organization_id,m.role)='org_admin')) then raise exception 'REQUESTER_NO_LONGER_AUTHORIZED';end if;
 if approve and c.target_organization_id is not null then raise exception 'LINK_ALREADY_EXISTS';end if;
 update public.client_organization_links set status=case when approve then 'active' else 'rejected' end,decided_by=auth.uid(),decided_at=now() where id=link;
 if approve then update public.agency_clients set target_organization_id=l.employer_id where id=c.id;end if;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(c.organization_id,auth.uid(),'agency_clients',c.id,case when approve then 'organization_link_approved' else 'organization_link_rejected' end,jsonb_build_object('link_id',link,'employer_id',l.employer_id));
end$$;

create function public.end_portal_organization_link(link uuid) returns void language plpgsql security definer set search_path='' as $$
declare l public.client_organization_links;c public.agency_clients;begin
 select c0.* into strict c from public.agency_clients c0 join public.client_organization_links l0 on l0.client_id=c0.id where l0.id=link for update of c0;
 select * into strict l from public.client_organization_links where id=link for update;
 if not public.org_capability(c.organization_id,'organization.manage') and not public.org_capability(l.employer_id,'organization.manage') then raise exception 'NOT_PERMITTED';end if;
 if l.status not in('pending','active') then raise exception 'LINK_NOT_ACTIVE';end if;
 update public.client_organization_links set status='ended',decided_by=auth.uid(),decided_at=now() where id=link;
 update public.agency_clients set target_organization_id=null where id=c.id and target_organization_id=l.employer_id;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(c.organization_id,auth.uid(),'agency_clients',c.id,'organization_link_ended',jsonb_build_object('link_id',link));
 -- Individual portal access is separate, and remains under the agency's explicit member settings.
end$$;

create function public.guard_client_organization_link() returns trigger language plpgsql security definer set search_path='' as $$begin
 if (tg_op='INSERT' and new.target_organization_id is not null) or (tg_op='UPDATE' and new.target_organization_id is distinct from old.target_organization_id) then
  if new.target_organization_id is not null and not exists(select 1 from public.client_organization_links l where l.client_id=new.id and l.employer_id=new.target_organization_id and l.status='active') then raise exception 'APPROVED_LINK_REQUIRED';end if;
  if new.target_organization_id is null and exists(select 1 from public.client_organization_links l where l.client_id=new.id and l.status='active') then raise exception 'END_LINK_FIRST';end if;
 end if;return new;
end$$;
create trigger guard_client_organization_link before insert or update of target_organization_id on public.agency_clients for each row execute function public.guard_client_organization_link();

create function public.organization_portal_connections(org uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not public.org_capability(org,'organization.manage') then raise exception 'NOT_PERMITTED';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'client_name',c.name,'agency_name',a.name,'status',l.status,'portal_access',public.has_client_portal(c.id))) from public.client_organization_links l join public.agency_clients c on c.id=l.client_id join public.organizations a on a.id=c.organization_id where l.employer_id=org and l.status in('pending','active')),'[]'::jsonb);
end$$;
revoke all on function public.portal_transition_options(),public.request_portal_organization_link(uuid,uuid,text,text),public.agency_client_link_state(uuid),public.decide_portal_organization_link(uuid,boolean),public.end_portal_organization_link(uuid),public.organization_portal_connections(uuid),public.guard_client_organization_link() from public,anon;
grant execute on function public.portal_transition_options(),public.request_portal_organization_link(uuid,uuid,text,text),public.agency_client_link_state(uuid),public.decide_portal_organization_link(uuid,boolean),public.end_portal_organization_link(uuid),public.organization_portal_connections(uuid) to authenticated;
commit;
