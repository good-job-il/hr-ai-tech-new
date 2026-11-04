begin;
create table public.recruitment_partnerships (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations,
 name text not null check(length(trim(name)) between 1 and 160),
 partner_type text not null check(partner_type in ('employer','agency','staffing')),
 contact_name text not null default '' check(length(contact_name)<=160),
 contact_email text not null default '' check(length(contact_email)<=254),
 contact_phone text not null default '' check(length(contact_phone)<=40),
 contact_role text not null default '' check(length(contact_role)<=160),
 status text not null default 'draft' check(status in ('draft','active','suspended','ended','cancelled')),
 starts_on date, ends_on date,
 terms text not null default '' check(length(terms)<=12000),
 internal_notes text not null default '' check(length(internal_notes)<=8000),
 created_by uuid not null default auth.uid() references auth.users,
 created_at timestamptz not null default now(),
 check(ends_on is null or starts_on is null or ends_on>=starts_on)
);
alter table public.recruitment_partnerships enable row level security;
create policy partnerships_read on public.recruitment_partnerships for select to authenticated using(public.org_capability(organization_id,'jobs.manage'));
create policy partnerships_insert on public.recruitment_partnerships for insert to authenticated with check(public.org_capability(organization_id,'jobs.manage') and created_by=auth.uid() and status='draft');
create policy partnerships_update on public.recruitment_partnerships for update to authenticated using(public.org_capability(organization_id,'jobs.manage')) with check(public.org_capability(organization_id,'jobs.manage'));
revoke all on public.recruitment_partnerships from public,anon,authenticated;
grant select,insert on public.recruitment_partnerships to authenticated;
grant update(name,partner_type,contact_name,contact_email,contact_phone,contact_role,status,starts_on,ends_on,terms,internal_notes) on public.recruitment_partnerships to authenticated;
create function public.audit_partnership() returns trigger language plpgsql security definer set search_path='' as $$begin
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(new.organization_id,auth.uid(),'recruitment_partnerships',new.id,case when TG_OP='INSERT' then 'partnership_created' else 'partnership_updated' end,jsonb_build_object('status',new.status));
 return new;
end$$;
create trigger audit_partnership after insert or update on public.recruitment_partnerships for each row execute function public.audit_partnership();
commit;
