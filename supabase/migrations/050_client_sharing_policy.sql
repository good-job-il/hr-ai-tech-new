begin;
create table public.agency_client_portal_policy(
 client_id uuid primary key references public.agency_clients,
 anonymous boolean not null default false,
 interview_coordinator text not null default 'agency' check(interview_coordinator in('agency','client')),
 updated_at timestamptz not null default now(),updated_by uuid not null references auth.users
);
alter table public.agency_client_portal_policy enable row level security;
revoke all on public.agency_client_portal_policy from public,anon,authenticated;
alter table public.client_presentations add column privacy_version integer not null default 1;
alter table public.client_feedback add column privacy_version integer not null default 1;
create function public.client_sharing_policy(client uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare org uuid;begin
 select organization_id into strict org from public.agency_clients where id=client;
 if not public.org_capability(org,'jobs.manage') then raise exception 'Not permitted';end if;
 return jsonb_build_object('anonymous',coalesce((select anonymous from public.agency_client_portal_policy where client_id=client),false),'interview_coordinator',coalesce((select interview_coordinator from public.agency_client_portal_policy where client_id=client),'agency'));
end$$;
create function public.placement_sharing_policy(placement uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare client uuid;begin
 if not public.can_manage_placement(placement) then raise exception 'Not permitted';end if;
 select j.client_id into client from public.candidate_placements p join public.jobs j on j.id=p.job_id where p.id=placement;
 if client is null then return jsonb_build_object('anonymous',false,'interview_coordinator','agency');end if;
 return jsonb_build_object('anonymous',coalesce((select anonymous from public.agency_client_portal_policy where client_id=client),false),'interview_coordinator',coalesce((select interview_coordinator from public.agency_client_portal_policy where client_id=client),'agency'));
end$$;
create function public.set_client_sharing_policy(client uuid,anonymous boolean,interview_coordinator text) returns void language plpgsql security definer set search_path='' as $$declare org uuid;begin
 select organization_id into strict org from public.agency_clients where id=client for update;
 if not public.org_capability(org,'organization.manage') then raise exception 'Not permitted';end if;
 insert into public.agency_client_portal_policy(client_id,anonymous,interview_coordinator,updated_by) values(client,anonymous,interview_coordinator,auth.uid()) on conflict(client_id) do update set anonymous=excluded.anonymous,interview_coordinator=excluded.interview_coordinator,updated_at=now(),updated_by=auth.uid();
 -- Old identified snapshots must disappear immediately when the client becomes anonymous.
 if anonymous then update public.client_presentations set revoked_at=now() where client_id=client and coalesce((snapshot->>'anonymous')::boolean,false)=false and revoked_at is null;end if;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(org,auth.uid(),'agency_clients',client,'client_sharing_policy_updated',jsonb_build_object('anonymous',anonymous,'interview_coordinator',interview_coordinator));
end$$;
alter function public.share_candidate_portal(uuid,text,uuid) rename to share_candidate_portal_identified_internal;
revoke all on function public.share_candidate_portal_identified_internal(uuid,text,uuid) from public,anon,authenticated;
create function public.share_candidate_portal(submission uuid,professional_summary text default '',document uuid default null,anonymous_reviewed boolean default false) returns uuid language plpgsql security definer set search_path='' as $$declare pid uuid;hidden boolean;c public.candidates;token text;begin
 -- Lock the client so policy changes and sharing cannot race.
 perform 1 from public.agency_clients ac join public.jobs j on j.client_id=ac.id join public.candidate_placements p on p.job_id=j.id join public.candidate_submissions s on s.placement_id=p.id where s.id=submission for update of ac;
 select coalesce(q.anonymous,false) into hidden from public.candidate_submissions s join public.candidate_placements p on p.id=s.placement_id join public.jobs j on j.id=p.job_id left join public.agency_client_portal_policy q on q.client_id=j.client_id where s.id=submission;
 if hidden then
 if document is not null or not anonymous_reviewed then raise exception 'ANONYMOUS_REVIEW_REQUIRED_NO_ORIGINAL_CV';end if;
 select cand.* into strict c from public.candidates cand join public.candidate_placements p on p.candidate_id=cand.id join public.candidate_submissions s on s.placement_id=p.id where s.id=submission;
 if professional_summary ~ '[[:digit:]][[:digit:] .()+-]{6,}' or professional_summary ~ '[^[:space:]]+@[^[:space:]]+' then raise exception 'IDENTIFIER_IN_ANONYMOUS_SUMMARY';end if;
 foreach token in array regexp_split_to_array(concat_ws(' ',c.full_name,c.city),'[[:space:]]+') loop
 if length(token)>=2 and position(lower(token) in lower(professional_summary))>0 then raise exception 'IDENTIFIER_IN_ANONYMOUS_SUMMARY';end if;end loop;
end if;
 pid:=public.share_candidate_portal_identified_internal(submission,case when hidden then '' else professional_summary end,document);
 if hidden then
 update public.client_presentations set snapshot=jsonb_build_object('anonymous',true,'full_name','מועמד / Candidate '||left(id::text,8),'job_title',snapshot->>'job_title','headline','','skills','','city','','summary',professional_summary,'document_id',null),privacy_version=privacy_version+1 where id=pid;
 else update public.client_presentations set snapshot=snapshot||jsonb_build_object('anonymous',false) where id=pid;end if;
 return pid;
end$$;
-- Only feedback created for the current anonymous share may be shown externally.
create function public.client_feedback_privacy_version() returns trigger language plpgsql security definer set search_path='' as $$begin select privacy_version into new.privacy_version from public.client_presentations where id=new.presentation_id;return new;end$$;
create trigger client_feedback_privacy before insert on public.client_feedback for each row execute function public.client_feedback_privacy_version();
alter table public.client_feedback drop constraint client_feedback_action_check;
alter table public.client_feedback add constraint client_feedback_action_check check(action in('proceed','reject','information','interview','interview_scheduled','hired','started','ended','note'));
alter function public.submit_client_feedback(uuid,text,text,timestamptz) rename to submit_client_feedback_internal;
revoke all on function public.submit_client_feedback_internal(uuid,text,text,timestamptz) from public,anon,authenticated;
create function public.submit_client_feedback(presentation uuid,feedback_action text,feedback_note text default '',interview_at timestamptz default null) returns void language plpgsql security definer set search_path='' as $$declare s public.client_presentations;coordinator text;begin
 select * into strict s from public.client_presentations where id=presentation for update;
 if s.revoked_at is not null or not public.has_client_portal(s.client_id) then raise exception 'Not permitted';end if;
 select coalesce((select interview_coordinator from public.agency_client_portal_policy where client_id=s.client_id),'agency') into coordinator;
 if feedback_action='interview_scheduled' then
 if coordinator<>'client' or interview_at is null or interview_at<=now() then raise exception 'INVALID_INTERVIEW_TIME_OR_COORDINATOR';end if;
 -- Record the client's confirmed scheduling, without releasing candidate contact details.
 perform public.submit_client_feedback_internal(presentation,'interview',feedback_note,interview_at);
 update public.client_feedback set action='interview_scheduled' where id=(select id from public.client_feedback where presentation_id=presentation and actor_id=auth.uid() order by created_at desc,id desc limit 1);
 if not exists(select 1 from public.placement_interviews where placement_id=s.placement_id and starts_at=interview_at and cancelled_at is null) then insert into public.placement_interviews(placement_id,starts_at,notes) values(s.placement_id,interview_at,'Client scheduled / תואם על ידי הלקוח');end if;
 else perform public.submit_client_feedback_internal(presentation,feedback_action,feedback_note,interview_at);end if;
end$$;
revoke all on function public.client_feedback_privacy_version() from public,anon,authenticated;
revoke all on function public.client_sharing_policy(uuid),public.placement_sharing_policy(uuid),public.set_client_sharing_policy(uuid,boolean,text),public.share_candidate_portal(uuid,text,uuid,boolean),public.submit_client_feedback(uuid,text,text,timestamptz) from public,anon;
grant execute on function public.client_sharing_policy(uuid),public.placement_sharing_policy(uuid),public.set_client_sharing_policy(uuid,boolean,text),public.share_candidate_portal(uuid,text,uuid,boolean),public.submit_client_feedback(uuid,text,text,timestamptz) to authenticated;
create or replace function public.client_portal_data() returns jsonb language sql stable security definer set search_path='' as $$select jsonb_build_object('clients',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'agency',o.name,'interview_coordinator',coalesce((select interview_coordinator from public.agency_client_portal_policy where client_id=c.id),'agency'))) from public.agency_clients c join public.organizations o on o.id=c.organization_id where public.has_client_portal(c.id)),'[]'::jsonb),'presentations',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'client_id',s.client_id,'snapshot',s.snapshot,'shared_at',s.shared_at,'pipeline_status',(select p.status from public.candidate_placements p where p.id=s.placement_id),'employment',(select jsonb_build_object('starts_on',e.starts_on,'ends_on',e.ends_on) from public.placement_employment e where e.placement_id=s.placement_id),'feedback',coalesce((select jsonb_agg(jsonb_build_object('action',f.action,'note',f.note,'proposed_at',f.proposed_at,'created_at',f.created_at) order by f.created_at desc) from public.client_feedback f where f.presentation_id=s.id and f.privacy_version=s.privacy_version),'[]'::jsonb)) order by s.shared_at desc) from public.client_presentations s where s.revoked_at is null and public.has_client_portal(s.client_id)),'[]'::jsonb))$$;

create or replace function public.agency_client_workspace(client uuid,section text default 'overview',page integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$declare c public.agency_clients;result jsonb;begin
 select * into strict c from public.agency_clients where id=client;
 if not public.org_capability(c.organization_id,'jobs.manage') then raise exception 'Not permitted';end if;
 if section not in('overview','jobs','candidates','interviews','portal','terms') or page<0 or page>100000 then raise exception 'INVALID_FILTER';end if;
 return jsonb_build_object('client',jsonb_build_object('id',c.id,'name',c.name,'contact_name',c.contact_name,'contact_email',c.contact_email,'active',c.active,'notes',case when public.org_capability(c.organization_id,'organization.manage') then c.notes else '' end),
 'counts',jsonb_build_object('jobs',(select count(*) from public.jobs j where j.client_id=c.id),'open_jobs',(select count(*) from public.jobs j where j.client_id=c.id and j.status='open'),'candidates',(select count(*) from public.client_presentations s where s.client_id=c.id and public.can_manage_placement(s.placement_id)),'interviews',(select count(*) from public.placement_interviews i join public.candidate_placements p on p.id=i.placement_id join public.jobs j on j.id=p.job_id where j.client_id=c.id and public.can_manage_placement(p.id)),'portal_accounts',case when public.org_capability(c.organization_id,'organization.manage') then (select count(*) from public.client_portal_members m where m.client_id=c.id and m.active) else null end),
 'jobs',case when section in('overview','jobs') then coalesce((select jsonb_agg(to_jsonb(r)) from(select j.id,j.title,j.location,j.status,j.is_public from public.jobs j where j.client_id=c.id and (section='jobs' or j.status='open') order by j.created_at desc,j.id limit (case when section='overview' then 5 else 25 end) offset (case when section='overview' then 0 else page*25 end))r),'[]'::jsonb) else '[]'::jsonb end,
 'candidates',case when section='candidates' then coalesce((select jsonb_agg(to_jsonb(r)) from(select s.id,s.placement_id,j.id as job_id,(select cand.full_name from public.candidates cand where cand.id=p.candidate_id) as full_name,j.title as job_title,p.status,s.shared_at,s.revoked_at,(select f.note from public.client_feedback f where f.presentation_id=s.id order by f.created_at desc,f.id desc limit 1) as latest_feedback from public.client_presentations s join public.candidate_placements p on p.id=s.placement_id join public.jobs j on j.id=p.job_id where s.client_id=c.id and public.can_manage_placement(p.id) order by s.shared_at desc,s.id limit 25 offset page*25)r),'[]'::jsonb) else '[]'::jsonb end,
 'interviews',case when section='interviews' then coalesce((select jsonb_agg(to_jsonb(r)) from(select i.id,i.starts_at,i.cancelled_at,p.job_id,cand.full_name,j.title as job_title from public.placement_interviews i join public.candidate_placements p on p.id=i.placement_id join public.candidates cand on cand.id=p.candidate_id join public.jobs j on j.id=p.job_id where j.client_id=c.id and public.can_manage_placement(p.id) order by i.starts_at desc,i.id limit 25 offset page*25)r),'[]'::jsonb) else '[]'::jsonb end);
end$$;
commit;
