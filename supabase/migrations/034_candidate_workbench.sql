begin;
-- Empty email is a missing value, never a fabricated identity. A real contact is required.
alter table public.candidates drop constraint candidates_email_check;
alter table public.candidates drop constraint candidate_email_format;
alter table public.candidates drop constraint candidates_organization_id_email_key_key;
alter table public.candidates alter column email set default '';
alter table public.candidates add constraint candidate_optional_email check(length(email)<=254 and (email='' or trim(email) ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'));
alter table public.candidates add constraint candidate_real_contact check(email<>'' or phone_key is not null);
create unique index candidate_org_email_unique on public.candidates(organization_id,email_key) where email_key<>'';
alter table public.candidates add column city text not null default '' check(length(city)<=240),add column headline text not null default '' check(length(headline)<=240),add column skills text not null default '' check(length(skills)<=4000),add column education text not null default '' check(length(education)<=4000),add column languages text not null default '' check(length(languages)<=1000),add column availability text not null default '' check(length(availability)<=240),add column experience_years numeric check(experience_years between 0 and 80),add column salary_min numeric check(salary_min>=0),add column salary_max numeric check(salary_max>=0 and (salary_min is null or salary_max>=salary_min)),add column search_status text not null default 'unknown' check(search_status in ('unknown','looking','not_looking','later')),add column last_contact_at date,add column search_confirmed_at date,add column source_updated_at date,add column updated_at timestamptz not null default now();
grant insert(city,headline,skills,education,languages,availability,experience_years,salary_min,salary_max,search_status,last_contact_at,search_confirmed_at,source_updated_at) on public.candidates to authenticated;
create function public.touch_candidate_profile() returns trigger language plpgsql set search_path='' as $$begin if (to_jsonb(new)-'merged_into'-'updated_at'-'email_key'-'phone_key') is distinct from (to_jsonb(old)-'merged_into'-'updated_at'-'email_key'-'phone_key') then new.updated_at:=now();end if;return new;end$$;
create trigger candidate_profile_touch before update on public.candidates for each row execute function public.touch_candidate_profile();
create or replace function public.update_candidate_details(candidate uuid,candidate_name text,candidate_email text,pool text,phone text) returns void language plpgsql security definer set search_path='' as $$declare c public.candidates;begin
 select * into strict c from public.candidates where id=candidate and merged_into is null for update;
 if not public.can_read_candidate(candidate) or not public.org_capability(c.organization_id,'candidates.write') or (c.owner_id<>auth.uid() and not public.org_capability(c.organization_id,'candidates.all')) then raise exception 'Not permitted';end if;
 if pool='personal' and not exists(select 1 from public.organizations where id=c.organization_id and kind='agency') then raise exception 'Personal pool is agency-only';end if;
 update public.candidates set full_name=trim(candidate_name),email=lower(trim(coalesce(candidate_email,''))),visibility=pool,phone=trim(coalesce(update_candidate_details.phone,'')) where id=candidate;
end$$;
create table public.career_roles(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,domain text not null default '' check(length(domain)<=160),name text not null check(length(trim(name)) between 1 and 240),created_by uuid not null references auth.users,unique(organization_id,name));
create table public.candidate_interests(id uuid primary key default gen_random_uuid(),candidate_id uuid not null references public.candidates,role_id uuid not null references public.career_roles,active boolean not null default true,confirmed_at date,created_at timestamptz not null default now(),unique(candidate_id,role_id));
create table public.candidate_saved_filters(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,user_id uuid not null references auth.users,name text not null check(length(trim(name)) between 1 and 120),filters jsonb not null check(jsonb_typeof(filters)='object' and octet_length(filters::text)<=8000),created_at timestamptz not null default now());
alter table public.career_roles enable row level security;alter table public.candidate_interests enable row level security;alter table public.candidate_saved_filters enable row level security;
create policy career_roles_read on public.career_roles for select to authenticated using(public.is_member(organization_id));
create policy candidate_interest_read on public.candidate_interests for select to authenticated using(public.can_read_candidate(candidate_id));
create policy candidate_filter_own on public.candidate_saved_filters for all to authenticated using(user_id=auth.uid() and public.is_member(organization_id)) with check(user_id=auth.uid() and public.is_member(organization_id));
revoke all on public.career_roles,public.candidate_interests,public.candidate_saved_filters from public,anon,authenticated;
grant select on public.career_roles,public.candidate_interests to authenticated;grant select,insert,update,delete on public.candidate_saved_filters to authenticated;
create function public.save_candidate_professional(candidate uuid,details jsonb) returns void language plpgsql security definer set search_path='' as $$declare c public.candidates;begin
 select * into strict c from public.candidates where id=candidate and merged_into is null for update;
 if not public.can_read_candidate(candidate) or not public.org_capability(c.organization_id,'candidates.write') or (c.owner_id<>auth.uid() and not public.org_capability(c.organization_id,'candidates.all')) then raise exception 'Not permitted';end if;
 update public.candidates set city=coalesce(details->>'city',''),headline=coalesce(details->>'headline',''),skills=coalesce(details->>'skills',''),education=coalesce(details->>'education',''),languages=coalesce(details->>'languages',''),availability=coalesce(details->>'availability',''),experience_years=nullif(details->>'experience_years','')::numeric,salary_min=nullif(details->>'salary_min','')::numeric,salary_max=nullif(details->>'salary_max','')::numeric,search_status=coalesce(nullif(details->>'search_status',''),'unknown'),last_contact_at=nullif(details->>'last_contact_at','')::date,search_confirmed_at=nullif(details->>'search_confirmed_at','')::date,source_updated_at=nullif(details->>'source_updated_at','')::date where id=candidate;
end$$;
create function public.set_candidate_interest(candidate uuid,role_name text,domain_name text default '',active boolean default true,confirmed date default null) returns uuid language plpgsql security definer set search_path='' as $$declare c public.candidates;rid uuid;iid uuid;begin
 select * into strict c from public.candidates where id=candidate and merged_into is null for update;
 if not public.can_read_candidate(candidate) or not public.org_capability(c.organization_id,'candidates.write') or (c.owner_id<>auth.uid() and not public.org_capability(c.organization_id,'candidates.all')) then raise exception 'Not permitted';end if;
 insert into public.career_roles(organization_id,name,domain,created_by) values(c.organization_id,trim(role_name),trim(coalesce(domain_name,'')),auth.uid()) on conflict(organization_id,name) do nothing;
 select id into strict rid from public.career_roles where organization_id=c.organization_id and name=trim(role_name);
 insert into public.candidate_interests(candidate_id,role_id,active,confirmed_at) values(candidate,rid,set_candidate_interest.active,confirmed) on conflict(candidate_id,role_id) do update set active=excluded.active,confirmed_at=excluded.confirmed_at returning id into iid;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(c.organization_id,auth.uid(),'candidates',candidate,'interest_updated',jsonb_build_object('role_id',rid,'active',active));return iid;
end$$;
create function public.search_candidate_pool(org uuid,filters jsonb default '{}',page integer default 0) returns jsonb language plpgsql stable security invoker set search_path='' as $$declare rows jsonb;total bigint;begin
 if not public.is_member(org) or page<0 then raise exception 'Not permitted';end if;
 with matches as(select c.* from public.candidates c where c.organization_id=org and c.merged_into is null
 and (coalesce(filters->>'query','')='' or concat_ws(' ',c.full_name,c.email,c.phone,c.headline,c.skills) ilike '%'||(filters->>'query')||'%')
 and (coalesce(filters->>'city','')='' or c.city ilike '%'||(filters->>'city')||'%')
 and (coalesce(filters->>'language','')='' or c.languages ilike '%'||(filters->>'language')||'%')
 and (coalesce(filters->>'status','')='' or c.search_status=filters->>'status')
 and (coalesce(filters->>'pool','all')='all' or (filters->>'pool'='mine' and c.owner_id=auth.uid()) or c.visibility=filters->>'pool')
 and (coalesce(filters->>'role','')='' or exists(select 1 from public.candidate_interests i join public.career_roles r on r.id=i.role_id where i.candidate_id=c.id and i.active and r.name ilike '%'||(filters->>'role')||'%'))
 and (coalesce(filters->>'domain','')='' or exists(select 1 from public.candidate_interests i join public.career_roles r on r.id=i.role_id where i.candidate_id=c.id and i.active and r.domain ilike '%'||(filters->>'domain')||'%'))
 and (nullif(filters->>'experience_min','') is null or c.experience_years>=(filters->>'experience_min')::numeric)
 and (coalesce(filters->>'incomplete','false')<>'true' or c.city='' or c.headline='' or c.search_status='unknown'))
 select (select count(*) from matches),coalesce((select jsonb_agg(to_jsonb(v)) from(select * from matches order by full_name,id limit 25 offset page*25)v),'[]') into total,rows;
 return jsonb_build_object('count',total,'rows',rows);
end$$;
create index candidate_interests_candidate_idx on public.candidate_interests(candidate_id);
create index career_roles_org_idx on public.career_roles(organization_id);
create index candidates_org_name_idx on public.candidates(organization_id,full_name,id) where merged_into is null;
revoke all on function public.touch_candidate_profile(),public.save_candidate_professional(uuid,jsonb),public.set_candidate_interest(uuid,text,text,boolean,date),public.search_candidate_pool(uuid,jsonb,integer) from public,anon;
grant execute on function public.save_candidate_professional(uuid,jsonb),public.set_candidate_interest(uuid,text,text,boolean,date),public.search_candidate_pool(uuid,jsonb,integer) to authenticated;
commit;
