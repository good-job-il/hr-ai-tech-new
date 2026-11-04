begin;
create or replace function public.submit_client_feedback(presentation uuid,feedback_action text,feedback_note text default '',interview_at timestamptz default null) returns void language plpgsql security definer set search_path='' as $$declare s public.client_presentations;coordinator text;begin
 select * into strict s from public.client_presentations where id=presentation for update;
 if s.revoked_at is not null or not public.has_client_portal(s.client_id) then raise exception 'Not permitted';end if;
 select coalesce((select interview_coordinator from public.agency_client_portal_policy where client_id=s.client_id),'agency') into coordinator;
 if feedback_action='interview_scheduled' then
 if coordinator<>'client' or interview_at is null or interview_at<=now() then raise exception 'INVALID_INTERVIEW_TIME_OR_COORDINATOR';end if;
 -- Record the client's confirmed scheduling, without releasing candidate contact details.
 insert into public.client_feedback(presentation_id,actor_id,action,note,proposed_at) values(presentation,auth.uid(),'interview_scheduled',feedback_note,interview_at);
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) select organization_id,auth.uid(),'candidate_placements',s.placement_id,'client_feedback_received',jsonb_build_object('action','interview_scheduled') from public.agency_clients where id=s.client_id;
 if not exists(select 1 from public.placement_interviews where placement_id=s.placement_id and starts_at=interview_at and cancelled_at is null) then insert into public.placement_interviews(placement_id,starts_at,notes) values(s.placement_id,interview_at,'Client scheduled / תואם על ידי הלקוח');end if;
 else perform public.submit_client_feedback_internal(presentation,feedback_action,feedback_note,interview_at);end if;
end$$;
commit;
