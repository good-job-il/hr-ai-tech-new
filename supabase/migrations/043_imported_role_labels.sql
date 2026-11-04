begin;
create function public.strip_import_role_code(value text) returns text language sql immutable set search_path='' as $$select trim(regexp_replace(trim(coalesce(value,'')),'[[:space:]]*\([0-9]+\)[[:space:]]*$',''))$$;
create table public.role_import_label_repairs(role_id uuid primary key references public.career_roles,organization_id uuid not null references public.organizations,previous_name text not null,repaired_name text not null,actor_id uuid not null references auth.users,repaired_at timestamptz not null default now());
alter table public.role_import_label_repairs enable row level security;
create policy role_import_label_repairs_read on public.role_import_label_repairs for select to authenticated using(public.is_member(organization_id));
revoke all on public.role_import_label_repairs from public,anon,authenticated;grant select on public.role_import_label_repairs to authenticated;
create function public.clean_imported_role_labels(org uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare r record;clean text;changed integer:=0;conflicts integer:=0;begin
 if not public.org_capability(org,'candidates.all') or not public.org_capability(org,'candidates.write') then raise exception 'Not permitted';end if;
 perform pg_advisory_xact_lock(hashtextextended(org::text,43));
 for r in with imported_names as materialized(select distinct trim(v.value) as name from public.candidate_import_rows ir join public.candidate_import_jobs j on j.id=ir.job_id cross join lateral unnest(string_to_array(coalesce(ir.payload->>'roles',''),';')) v(value) where j.organization_id=org) select cr.id,cr.name from public.career_roles cr join imported_names i on i.name=cr.name where cr.organization_id=org and cr.name<>public.strip_import_role_code(cr.name) order by cr.id for update of cr loop
 clean:=public.strip_import_role_code(r.name);
 if clean='' or exists(select 1 from public.career_roles where organization_id=org and name=clean and id<>r.id) then conflicts:=conflicts+1;continue;end if;
 insert into public.role_import_label_repairs(role_id,organization_id,previous_name,repaired_name,actor_id) values(r.id,org,r.name,clean,auth.uid()) on conflict do nothing;
 update public.career_roles set name=clean where id=r.id;changed:=changed+1;
 end loop;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(org,auth.uid(),'organizations',org,'import_role_labels_cleaned',jsonb_build_object('changed',changed,'conflicts_skipped',conflicts));
 return jsonb_build_object('changed',changed,'conflicts_skipped',conflicts);
end$$;
revoke all on function public.strip_import_role_code(text),public.clean_imported_role_labels(uuid) from public,anon;
grant execute on function public.strip_import_role_code(text),public.clean_imported_role_labels(uuid) to authenticated;
create or replace function public.normalize_candidate_import_record(details jsonb) returns jsonb language plpgsql immutable set search_path='' as $$declare p jsonb:=details;k text;v text;begin
 foreach k in array array['source_updated_at','source_last_updated_at','interest_confirmed_at','last_contact_at','search_confirmed_at'] loop
 if p?k then p:=jsonb_set(p,array[k],coalesce(to_jsonb(public.candidate_source_date(p->>k)),'null'::jsonb));end if;end loop;
 foreach k in array array['reported_age','birth_year'] loop
 if p?k and trim(coalesce(p->>k,'')) in('','-') then p:=jsonb_set(p,array[k],'null'::jsonb);end if;end loop;
 if p->>'phone' ~ '^5[0-9]{8}$' then p:=jsonb_set(p,array['phone'],to_jsonb('0'||(p->>'phone')));end if;
 if p?'roles' then select coalesce(string_agg(public.strip_import_role_code(value),';' order by position),'') into v from unnest(string_to_array(coalesce(p->>'roles',''),';')) with ordinality role(value,position);p:=jsonb_set(p,array['roles'],to_jsonb(v));end if;
 return p;
end$$;
commit;
