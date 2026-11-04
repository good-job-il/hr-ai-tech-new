begin;
-- Preserve unresolved source evidence and all candidate-interest IDs.
create function public.import_role_label(value text) returns text language sql immutable set search_path='' as $$select case when trim(value) ~ '^[0-9]+$' then 'תפקיד לא מזוהה מהייבוא · '||trim(value) else trim(value) end$$;
create table public.unresolved_role_sources(role_id uuid primary key references public.career_roles,organization_id uuid not null references public.organizations,source_code text not null,previous_name text not null,recorded_at timestamptz not null default now());
alter table public.unresolved_role_sources enable row level security;
create policy unresolved_role_sources_read on public.unresolved_role_sources for select to authenticated using(public.is_member(organization_id));
revoke all on public.unresolved_role_sources from public,anon,authenticated;
grant select on public.unresolved_role_sources to authenticated;
insert into public.unresolved_role_sources(role_id,organization_id,source_code,previous_name) select id,organization_id,trim(name),name from public.career_roles where trim(name) ~ '^[0-9]+$';
update public.career_roles set name=public.import_role_label(name) where trim(name) ~ '^[0-9]+$';
create or replace function public.set_candidate_interest(candidate uuid,role_name text,domain_name text default '',active boolean default true,confirmed date default null) returns uuid language plpgsql security definer set search_path='' as $$declare c public.candidates;rid uuid;iid uuid;source_value text:=trim(role_name);begin
 role_name:=public.import_role_label(role_name);
 select * into strict c from public.candidates where id=candidate and merged_into is null for update;
 if not public.can_read_candidate(candidate) or not public.org_capability(c.organization_id,'candidates.write') or (c.owner_id<>auth.uid() and not public.org_capability(c.organization_id,'candidates.all')) then raise exception 'Not permitted';end if;
 insert into public.career_roles(organization_id,name,domain,created_by) values(c.organization_id,trim(role_name),trim(coalesce(domain_name,'')),auth.uid()) on conflict(organization_id,name) do nothing;
 select id into strict rid from public.career_roles where organization_id=c.organization_id and name=trim(role_name);
 if source_value ~ '^[0-9]+$' then insert into public.unresolved_role_sources(role_id,organization_id,source_code,previous_name) values(rid,c.organization_id,source_value,source_value) on conflict do nothing;end if;
 insert into public.candidate_interests(candidate_id,role_id,active,confirmed_at) values(candidate,rid,set_candidate_interest.active,confirmed) on conflict(candidate_id,role_id) do update set active=excluded.active,confirmed_at=excluded.confirmed_at returning id into iid;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(c.organization_id,auth.uid(),'candidates',candidate,'interest_updated',jsonb_build_object('role_id',rid,'active',active));return iid;
end$$;

create or replace function public.platform_role_report(filters jsonb default '{}',page integer default 0,per_page integer default 25) returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;sort_expression text;direction text;begin
 if not public.is_platform_admin() then raise exception 'PLATFORM_ADMIN_REQUIRED';end if;
 if page is null or page<0 or page>100000 or per_page is null or per_page not between 1 and 500 then raise exception 'INVALID_PAGE';end if;
 sort_expression:=case coalesce(filters->>'sort_by','role') when 'role' then 'role' when 'domain' then 'domain' when 'candidates' then 'candidate_count' when 'classification' then 'classified' else null end;
 direction:=case coalesce(filters->>'direction','asc') when 'asc' then 'asc' when 'desc' then 'desc' else null end;
 if sort_expression is null or direction is null or coalesce(filters->>'classification','all') not in('all','classified','unclassified') then raise exception 'INVALID_FILTER';end if;
 execute format($query$
 with role_rows as materialized(select r.id,r.organization_id,trim(r.name) as name,trim(r.domain) as domain,lower(regexp_replace(trim(r.name),'[[:space:]]+',' ','g')) as name_key,lower(regexp_replace(trim(r.domain),'[[:space:]]+',' ','g')) as domain_key from public.career_roles r join public.organizations o on o.id=r.organization_id where not o.is_test and trim(r.name)<>''),
 people as materialized(select c.id,c.organization_id,case when c.phone_key is not null then 'p:'||case when c.phone_key ~ '^5[0-9]{8}$' then '972'||c.phone_key else c.phone_key end when c.email_key<>'' then 'e:'||c.email_key else null end as contact_key from public.candidates c join public.organizations o on o.id=c.organization_id where not o.is_test and c.merged_into is null),
 assigned as materialized(select r.name_key,r.domain_key,p.id as candidate_id,p.contact_key from role_rows r join public.candidate_interests i on i.role_id=r.id and i.active join people p on p.id=i.candidate_id and p.organization_id=r.organization_id),
 labels as(select name_key,domain_key,min(name) as role,min(domain) as domain from role_rows group by name_key,domain_key),
 totals as(select name_key,domain_key,count(distinct contact_key) as candidate_count from assigned group by name_key,domain_key),
 report_rows as materialized(select md5(l.name_key||chr(31)||l.domain_key) as key,l.role,l.domain,l.domain_key,l.domain_key<>'' as classified,coalesce(t.candidate_count,0) as candidate_count from labels l left join totals t on t.name_key=l.name_key and t.domain_key=l.domain_key),
 filtered as materialized(select * from report_rows where (coalesce($1->>'query','')='' or concat_ws(' ',role,domain) ilike '%%'||($1->>'query')||'%%') and (coalesce($1->>'domain','')='' or domain_key=$1->>'domain') and (coalesce($1->>'classification','all')='all' or ($1->>'classification'='classified' and classified) or ($1->>'classification'='unclassified' and not classified)))
 select jsonb_build_object('summary',jsonb_build_object('domains',(select count(distinct domain_key) from labels where domain_key<>''),'roles',(select count(*) from labels),'unique_candidates',(select count(distinct contact_key) from assigned),'unclassified',(select count(*) from labels where domain_key=''),'unresolved_roles',(select count(*) from labels where role like 'תפקיד לא מזוהה מהייבוא · %%'),'unidentified_records',(select count(distinct candidate_id) from assigned where contact_key is null)),
 'domains',coalesce((select jsonb_agg(d order by d.label) from(select domain_key as key,min(domain) as label from labels where domain_key<>'' group by domain_key)d),'[]'::jsonb),
 'count',(select count(*) from filtered),
 'rows',coalesce((select jsonb_agg(to_jsonb(v)-'domain_key') from(select * from filtered order by %I %s,key asc limit $3 offset $2*$3)v),'[]'::jsonb),'as_of',statement_timestamp())
 $query$,sort_expression,direction) into result using coalesce(filters,'{}'::jsonb),page,per_page;
 return result;
end$$;
revoke all on function public.platform_role_report(jsonb,integer,integer) from public,anon;
grant execute on function public.platform_role_report(jsonb,integer,integer) to authenticated;

revoke all on function public.import_role_label(text) from public,anon;
grant execute on function public.import_role_label(text) to authenticated;
commit;
