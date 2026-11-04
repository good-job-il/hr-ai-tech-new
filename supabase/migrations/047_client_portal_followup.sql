begin;
create function public.guard_shared_job_client() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.client_id is distinct from old.client_id and exists(select 1 from public.client_presentations s join public.candidate_placements p on p.id=s.placement_id where p.job_id=new.id) then raise exception 'CLIENT_LOCKED_AFTER_PRESENTATION';end if;return new;end$$;
create trigger guard_shared_job_client before update of client_id on public.jobs for each row execute function public.guard_shared_job_client();
create function public.notify_client_feedback() returns trigger language plpgsql security definer set search_path='' as $$declare recipient uuid;begin
 select shared_by into strict recipient from public.client_presentations where id=new.presentation_id;
 insert into public.notifications(user_id,kind) values(recipient,'client_feedback');return new;end$$;
create trigger client_feedback_notification after insert on public.client_feedback for each row execute function public.notify_client_feedback();
revoke all on function public.guard_shared_job_client(),public.notify_client_feedback() from public,anon,authenticated;
create function public.client_pilot_settings(client uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare org uuid;begin select organization_id into strict org from public.agency_clients where id=client;if not public.org_capability(org,'organization.manage') then raise exception 'Not permitted';end if;return jsonb_build_object('monthly_percent',(select monthly_hourly_fee_percent from public.agency_client_fee_terms where client_id=client),'portal_accounts',(select count(*) from public.client_portal_members where client_id=client and active));end$$;
revoke all on function public.client_pilot_settings(uuid) from public,anon;grant execute on function public.client_pilot_settings(uuid) to authenticated;
commit;
