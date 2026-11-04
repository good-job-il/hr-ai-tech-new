begin;
create table public.candidate_phone_prefix_repairs(candidate_id uuid primary key references public.candidates,organization_id uuid not null references public.organizations,previous_phone text not null,repaired_phone text not null,actor_id uuid not null references auth.users,repaired_at timestamptz not null default now());
alter table public.candidate_phone_prefix_repairs enable row level security;
create policy phone_prefix_repairs_read on public.candidate_phone_prefix_repairs for select to authenticated using(public.can_read_candidate(candidate_id));
revoke all on public.candidate_phone_prefix_repairs from public,anon,authenticated;grant select on public.candidate_phone_prefix_repairs to authenticated;
create function public.complete_candidate_mobile_prefix(org uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare n integer;conflicts integer;begin
 if not public.org_capability(org,'candidates.all') or not public.org_capability(org,'candidates.write') then raise exception 'Not permitted';end if;
 perform pg_advisory_xact_lock(hashtextextended(org::text,42));
 select count(*) into conflicts from public.candidates c where c.organization_id=org and c.merged_into is null and c.phone ~ '^5[0-9]{8}$' and exists(select 1 from public.candidates d where d.organization_id=org and d.id<>c.id and d.phone_key=public.normalize_candidate_phone('0'||c.phone));
 with eligible as materialized(select c.id,c.phone from public.candidates c where c.organization_id=org and c.merged_into is null and c.phone ~ '^5[0-9]{8}$' and not exists(select 1 from public.candidates d where d.organization_id=org and d.id<>c.id and d.phone_key=public.normalize_candidate_phone('0'||c.phone)) for update),logged as(insert into public.candidate_phone_prefix_repairs(candidate_id,organization_id,previous_phone,repaired_phone,actor_id) select id,org,phone,'0'||phone,auth.uid() from eligible on conflict do nothing returning candidate_id,previous_phone,repaired_phone)
 update public.candidates c set phone=l.repaired_phone from logged l where c.id=l.candidate_id and c.phone=l.previous_phone;get diagnostics n=row_count;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(org,auth.uid(),'organizations',org,'mobile_prefix_completed',jsonb_build_object('changed',n,'conflicts_skipped',conflicts));
 return jsonb_build_object('changed',n,'conflicts_skipped',conflicts);
end$$;
revoke all on function public.complete_candidate_mobile_prefix(uuid) from public,anon;grant execute on function public.complete_candidate_mobile_prefix(uuid) to authenticated;
create or replace function public.normalize_candidate_import_record(details jsonb) returns jsonb language plpgsql immutable set search_path='' as $$declare p jsonb:=details;k text;v text;begin
 foreach k in array array['source_updated_at','source_last_updated_at','interest_confirmed_at','last_contact_at','search_confirmed_at'] loop
 if p?k then p:=jsonb_set(p,array[k],coalesce(to_jsonb(public.candidate_source_date(p->>k)),'null'::jsonb));end if;end loop;
 foreach k in array array['reported_age','birth_year'] loop
 if p?k and trim(coalesce(p->>k,'')) in('','-') then p:=jsonb_set(p,array[k],'null'::jsonb);end if;end loop;
 if p->>'phone' ~ '^5[0-9]{8}$' then p:=jsonb_set(p,array['phone'],to_jsonb('0'||(p->>'phone')));end if;
 return p;
end$$;
commit;
