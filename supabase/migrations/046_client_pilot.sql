begin;
alter table public.jobs drop constraint jobs_type_check;alter table public.jobs add constraint jobs_type_check check(type in('full-time','part-time','contract','unspecified'));
alter table public.jobs add column is_public boolean not null default true;
grant update(is_public) on public.jobs to authenticated;
drop policy jobs_read on public.jobs;
create policy jobs_read on public.jobs for select using((status='open' and is_public and exists(select 1 from public.organizations o where o.id=organization_id and not o.is_test)) or public.is_member(organization_id) or public.applied_to(id));
create or replace view public.public_job_catalog with(security_invoker=true) as
 select j.id,false as external,null::text as source_id,j.title,j.location,j.type,left(j.description,280) as description,j.organization_id,o.name as company,j.category,j.work_mode,j.experience_years,j.salary_min,j.salary_max,j.created_at,null::timestamptz as verified_at,'{}'::jsonb as localized_content
 from public.jobs j join public.organizations o on o.id=j.organization_id where j.status='open' and j.is_public and not o.is_test
 union all
 select e.id,true,e.source_id,e.title,e.location,coalesce(e.employment_type,'unspecified'),left(e.description,280),null::uuid,s.company,e.department,null::text,null::integer,null::numeric,null::numeric,e.first_seen_at,e.verified_at,case when e.localized_content='{}'::jsonb then '{}'::jsonb else jsonb_build_object('he',jsonb_build_object('title',e.localized_content#>>'{he,title}','description',left(e.localized_content#>>'{he,description}',280)),'en',jsonb_build_object('title',e.localized_content#>>'{en,title}','description',left(e.localized_content#>>'{en,description}',280))) end
 from public.external_jobs e join public.job_sources s on s.id=e.source_id where e.publication_status='published' and e.status='active' and e.verified_at<=now()+interval '5 minutes' and e.verified_at>now()-interval '7 days';

create table public.pilot_source_jobs(source_system text not null,source_id text not null,job_id uuid not null unique references public.jobs,source_snapshot jsonb not null,imported_at timestamptz not null default now(),primary key(source_system,source_id));
alter table public.pilot_source_jobs enable row level security;revoke all on public.pilot_source_jobs from public,anon,authenticated;

create table public.agency_client_fee_terms(client_id uuid primary key references public.agency_clients,monthly_hourly_fee_percent numeric(5,2) not null check(monthly_hourly_fee_percent>0 and monthly_hourly_fee_percent<=100));
alter table public.agency_client_fee_terms enable row level security;revoke all on public.agency_client_fee_terms from public,anon,authenticated;
create function public.set_client_hourly_fee(client uuid,percent numeric) returns void language plpgsql security definer set search_path='' as $$declare org uuid;begin
select organization_id into strict org from public.agency_clients where id=client for update;if not public.org_capability(org,'organization.manage') then raise exception 'Not permitted';end if;
if exists(select 1 from public.placement_work_periods w join public.candidate_placements p on p.id=w.placement_id join public.jobs j on j.id=p.job_id where j.client_id=client) then raise exception 'FEE_LOCKED_AFTER_WORK_RECORDS';end if;
insert into public.agency_client_fee_terms(client_id,monthly_hourly_fee_percent) values(client,percent) on conflict(client_id) do update set monthly_hourly_fee_percent=excluded.monthly_hourly_fee_percent;
insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(org,auth.uid(),'agency_clients',client,'client_fee_terms_updated',jsonb_build_object('monthly_percent',percent,'minimum_days',30,'months',3));end$$;
revoke all on function public.set_client_hourly_fee(uuid,numeric) from public,anon;grant execute on function public.set_client_hourly_fee(uuid,numeric) to authenticated;

create table public.client_portal_members(client_id uuid not null references public.agency_clients,user_id uuid not null references auth.users,active boolean not null default true,created_at timestamptz not null default now(),primary key(client_id,user_id));
create table public.client_presentations(id uuid primary key default gen_random_uuid(),client_id uuid not null references public.agency_clients,placement_id uuid not null unique references public.candidate_placements,submission_id uuid not null references public.candidate_submissions,snapshot jsonb not null,shared_by uuid not null references auth.users,shared_at timestamptz not null default now(),revoked_at timestamptz);
create table public.client_feedback(id uuid primary key default gen_random_uuid(),presentation_id uuid not null references public.client_presentations,actor_id uuid not null references auth.users,action text not null check(action in('proceed','reject','information','interview','hired','started','ended','note')),note text not null default '' check(length(note)<=4000),proposed_at timestamptz,created_at timestamptz not null default now());
create table public.placement_employment(placement_id uuid primary key references public.candidate_placements,starts_on date not null,ends_on date,guarantee_days integer not null default 0 check(guarantee_days between 0 and 730),updated_at timestamptz not null default now(),updated_by uuid not null references auth.users,check(ends_on is null or ends_on>=starts_on));
create table public.placement_work_periods(id uuid primary key default gen_random_uuid(),placement_id uuid not null references public.placement_employment,month_number integer not null check(month_number between 1 and 3),base_hourly_rate numeric(10,2) not null check(base_hourly_rate>0),worked_hours numeric(10,2) not null check(worked_hours between 0 and 744),confirmed boolean not null default false,updated_by uuid not null references auth.users,updated_at timestamptz not null default now(),unique(placement_id,month_number));
alter table public.client_portal_members enable row level security;
alter table public.client_presentations enable row level security;
alter table public.client_feedback enable row level security;
alter table public.placement_employment enable row level security;
alter table public.placement_work_periods enable row level security;
revoke all on public.client_portal_members,public.client_presentations,public.client_feedback,public.placement_employment,public.placement_work_periods from public,anon,authenticated;
create function public.has_client_portal(client uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.client_portal_members m join public.agency_clients c on c.id=m.client_id where m.client_id=client and m.user_id=auth.uid() and m.active and c.active)$$;
create function public.set_client_portal_member(client uuid,email text,enabled boolean default true) returns void language plpgsql security definer set search_path='' as $$declare c public.agency_clients;uid uuid;begin
 select * into strict c from public.agency_clients where id=client for update;
 if not public.org_capability(c.organization_id,'organization.manage') then raise exception 'Not permitted';end if;
 select id into strict uid from auth.users where lower(auth.users.email)=lower(trim(set_client_portal_member.email)) and email_confirmed_at is not null;
 if public.is_member(c.organization_id) and uid=auth.uid() then raise exception 'USE_SEPARATE_CLIENT_ACCOUNT';end if;
 insert into public.client_portal_members(client_id,user_id,active) values(client,uid,enabled) on conflict(client_id,user_id) do update set active=excluded.active;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(c.organization_id,auth.uid(),'agency_clients',client,'portal_access_changed',jsonb_build_object('user_id',uid,'enabled',enabled));
end$$;
create function public.share_candidate_portal(submission uuid,professional_summary text default '',document uuid default null) returns uuid language plpgsql security definer set search_path='' as $$declare s public.candidate_submissions;p public.candidate_placements;j public.jobs;c public.candidates;pid uuid;begin
 select * into strict s from public.candidate_submissions where id=submission for update;
 select * into strict p from public.candidate_placements where id=s.placement_id;
 if s.status not in('approved','sent') or not public.can_manage_placement(p.id) or not(s.requested_by=auth.uid() or public.org_capability(p.organization_id,'candidates.all')) then raise exception 'Not permitted';end if;
 select * into strict j from public.jobs where id=p.job_id;
 if j.client_id is null or not exists(select 1 from public.agency_clients ac where ac.id=j.client_id and ac.organization_id=p.organization_id and ac.active) then raise exception 'ACTIVE_CLIENT_REQUIRED';end if;
 if length(professional_summary)>4000 then raise exception 'SUMMARY_TOO_LONG';end if;
 select * into strict c from public.candidates where id=p.candidate_id;
 if document is not null and not exists(select 1 from public.candidate_documents d where d.id=document and d.candidate_id=c.id and d.organization_id=p.organization_id) then raise exception 'INVALID_SHARED_DOCUMENT';end if;

 insert into public.client_presentations(client_id,placement_id,submission_id,snapshot,shared_by) values(j.client_id,p.id,s.id,jsonb_build_object('full_name',c.full_name,'headline',c.headline,'skills',c.skills,'city',c.city,'summary',professional_summary,'job_title',j.title,'document_id',document),auth.uid()) on conflict(placement_id) do update set snapshot=excluded.snapshot,submission_id=excluded.submission_id,shared_by=excluded.shared_by,shared_at=now(),revoked_at=null returning id into pid;
 update public.candidate_submissions set status='sent',sent_by=auth.uid(),sent_at=now() where id=s.id;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action) values(p.organization_id,auth.uid(),'candidate_placements',p.id,'candidate_shared_in_client_portal');return pid;
end$$;
create function public.revoke_client_presentation(presentation uuid) returns void language plpgsql security definer set search_path='' as $$declare x public.client_presentations;p public.candidate_placements;begin
 select * into strict x from public.client_presentations where id=presentation for update;select * into strict p from public.candidate_placements where id=x.placement_id;
 if not public.can_manage_placement(p.id) then raise exception 'Not permitted';end if;
 update public.client_presentations set revoked_at=now() where id=presentation;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action) values(p.organization_id,auth.uid(),'candidate_placements',p.id,'client_presentation_revoked');end$$;
create function public.client_portal_data() returns jsonb language sql stable security definer set search_path='' as $$select jsonb_build_object('clients',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'agency',o.name)) from public.agency_clients c join public.organizations o on o.id=c.organization_id where public.has_client_portal(c.id)),'[]'::jsonb),'presentations',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'client_id',s.client_id,'snapshot',s.snapshot,'shared_at',s.shared_at,'feedback',coalesce((select jsonb_agg(jsonb_build_object('action',f.action,'note',f.note,'proposed_at',f.proposed_at,'created_at',f.created_at) order by f.created_at desc) from public.client_feedback f where f.presentation_id=s.id),'[]'::jsonb)) order by s.shared_at desc) from public.client_presentations s where s.revoked_at is null and public.has_client_portal(s.client_id)),'[]'::jsonb))$$;
create function public.submit_client_feedback(presentation uuid,feedback_action text,feedback_note text default '',interview_at timestamptz default null) returns void language plpgsql security definer set search_path='' as $$declare s public.client_presentations;org uuid;begin
 select * into strict s from public.client_presentations where id=presentation for update;
 if s.revoked_at is not null or not public.has_client_portal(s.client_id) then raise exception 'Not permitted';end if;
 if interview_at is not null and(feedback_action<>'interview' or interview_at<=now()) then raise exception 'INVALID_INTERVIEW_TIME';end if;
 insert into public.client_feedback(presentation_id,actor_id,action,note,proposed_at) values(presentation,auth.uid(),feedback_action,feedback_note,interview_at);
 select organization_id into strict org from public.agency_clients where id=s.client_id;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(org,auth.uid(),'candidate_placements',s.placement_id,'client_feedback_received',jsonb_build_object('action',feedback_action));end$$;
create function public.save_placement_employment(placement uuid,start_date date,end_date date default null,warranty_days integer default 0) returns void language plpgsql security definer set search_path='' as $$declare p public.candidate_placements;begin
 select * into strict p from public.candidate_placements where id=placement for update;
 if not public.can_manage_placement(placement) or p.status<>'hired' or start_date>current_date or end_date>current_date then raise exception 'INVALID_EMPLOYMENT_OR_PERMISSION';end if;
 if exists(select 1 from public.placement_work_periods where placement_id=placement) and exists(select 1 from public.placement_employment where placement_id=placement and starts_on<>start_date) then raise exception 'START_DATE_LOCKED_AFTER_HOURS';end if;
 insert into public.placement_employment(placement_id,starts_on,ends_on,guarantee_days,updated_by) values(placement,start_date,end_date,warranty_days,auth.uid()) on conflict(placement_id) do update set starts_on=excluded.starts_on,ends_on=excluded.ends_on,guarantee_days=excluded.guarantee_days,updated_by=auth.uid(),updated_at=now();
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action) values(p.organization_id,auth.uid(),'candidate_placements',placement,'employment_dates_updated');end$$;
create function public.save_placement_work_period(placement uuid,period_number integer,hourly_rate numeric,hours numeric,is_confirmed boolean) returns void language plpgsql security definer set search_path='' as $$declare org uuid;begin
 select organization_id into strict org from public.candidate_placements where id=placement;
 if not public.can_manage_placement(placement) or not public.org_capability(org,'organization.manage') then raise exception 'Not permitted';end if;
 if not exists(select 1 from public.candidate_placements p join public.jobs j on j.id=p.job_id join public.agency_client_fee_terms c on c.client_id=j.client_id where p.id=placement and c.monthly_hourly_fee_percent is not null) then raise exception 'CLIENT_FEE_TERMS_REQUIRED';end if;
 insert into public.placement_work_periods(placement_id,month_number,base_hourly_rate,worked_hours,confirmed,updated_by) values(placement,period_number,hourly_rate,hours,is_confirmed,auth.uid()) on conflict(placement_id,month_number) do update set base_hourly_rate=excluded.base_hourly_rate,worked_hours=excluded.worked_hours,confirmed=excluded.confirmed,updated_by=auth.uid(),updated_at=now();
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(org,auth.uid(),'candidate_placements',placement,'work_period_updated',jsonb_build_object('period',period_number));end$$;
create function public.placement_pilot_details(placement uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare p public.candidate_placements;e public.placement_employment;financial boolean;fee numeric;begin
 select * into strict p from public.candidate_placements where id=placement;
 if not public.can_manage_placement(placement) then raise exception 'Not permitted';end if;
 select * into e from public.placement_employment where placement_id=placement;select c.monthly_hourly_fee_percent into fee from public.jobs j join public.agency_client_fee_terms c on c.client_id=j.client_id where j.id=p.job_id;financial:=fee is not null and public.org_capability(p.organization_id,'organization.manage');
 return jsonb_build_object('employment',case when e.placement_id is null then null else jsonb_build_object('starts_on',e.starts_on,'ends_on',e.ends_on,'guarantee_days',e.guarantee_days,'guarantee_until',e.starts_on+e.guarantee_days-1) end,'financial_access',financial,'presentations',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'revoked_at',s.revoked_at,'shared_at',s.shared_at,'client_name',c.name,'feedback',coalesce((select jsonb_agg(jsonb_build_object('action',f.action,'note',f.note,'proposed_at',f.proposed_at,'created_at',f.created_at) order by f.created_at desc) from public.client_feedback f where f.presentation_id=s.id),'[]'::jsonb))) from public.client_presentations s join public.agency_clients c on c.id=s.client_id where s.placement_id=placement),'[]'::jsonb),
 'periods',case when not financial then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('month_number',w.month_number,'from_date',d.a,'to_date',d.b,'base_hourly_rate',w.base_hourly_rate,'worked_hours',w.worked_hours,'confirmed',w.confirmed,'estimated_amount',round(w.base_hourly_rate*w.worked_hours*fee/100,2),'eligible',w.confirmed and least(coalesce(e.ends_on,current_date),current_date)-e.starts_on+1>=30 and d.b>=d.a and d.b<=current_date and w.worked_hours<=24*(d.b-d.a+1))) from public.placement_work_periods w cross join lateral(select (e.starts_on+make_interval(months=>w.month_number-1))::date a,least((e.starts_on+make_interval(months=>w.month_number))::date-1,coalesce(e.ends_on,'infinity'::date)) b)d where w.placement_id=placement),'[]'::jsonb) end);
end$$;
revoke all on function public.has_client_portal(uuid),public.set_client_portal_member(uuid,text,boolean),public.share_candidate_portal(uuid,text,uuid),public.revoke_client_presentation(uuid),public.client_portal_data(),public.submit_client_feedback(uuid,text,text,timestamptz),public.save_placement_employment(uuid,date,date,integer),public.save_placement_work_period(uuid,integer,numeric,numeric,boolean),public.placement_pilot_details(uuid) from public,anon;
grant execute on function public.has_client_portal(uuid),public.set_client_portal_member(uuid,text,boolean),public.share_candidate_portal(uuid,text,uuid),public.revoke_client_presentation(uuid),public.client_portal_data(),public.submit_client_feedback(uuid,text,text,timestamptz),public.save_placement_employment(uuid,date,date,integer),public.save_placement_work_period(uuid,integer,numeric,numeric,boolean),public.placement_pilot_details(uuid) to authenticated;

create function public.placement_share_documents(placement uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin if not public.can_manage_placement(placement) then raise exception 'Not permitted';end if;return coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'label',d.label)) from public.candidate_documents d join public.candidate_placements p on p.candidate_id=d.candidate_id and p.organization_id=d.organization_id where p.id=placement),'[]'::jsonb);end$$;
create function public.client_presentation_document(presentation uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare s public.client_presentations;d public.candidate_documents;begin
select * into strict s from public.client_presentations where id=presentation;if s.revoked_at is not null or not public.has_client_portal(s.client_id) then raise exception 'Not permitted';end if;
select * into strict d from public.candidate_documents where id=(s.snapshot->>'document_id')::uuid;
insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action) values(d.organization_id,auth.uid(),'candidate_documents',d.id,'client_document_view');return jsonb_build_object('path',d.object_path,'label',d.label);end$$;
create or replace function public.can_read_org_document(path text) returns boolean language plpgsql stable security definer set search_path='' as $$declare doc public.candidate_documents;c public.candidates;begin
select * into doc from public.candidate_documents where object_path=path;
if found then return public.can_read_candidate(doc.candidate_id) or exists(select 1 from public.client_presentations s where s.revoked_at is null and s.snapshot->>'document_id'=doc.id::text and public.has_client_portal(s.client_id));end if;
select * into c from public.candidates where id::text=split_part(path,'/',2) and organization_id::text=split_part(path,'/',1);return found and public.can_read_candidate(c.id);end$$;
revoke all on function public.placement_share_documents(uuid),public.client_presentation_document(uuid) from public,anon;grant execute on function public.placement_share_documents(uuid),public.client_presentation_document(uuid) to authenticated;
commit;

