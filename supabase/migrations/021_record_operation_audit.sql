begin;
create function public.audit_organization_record() returns trigger language plpgsql security definer set search_path='' as $$begin
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(new.organization_id,auth.uid(),TG_TABLE_NAME,new.id,lower(TG_OP),case when TG_TABLE_NAME='reward_entries' then jsonb_build_object('status',to_jsonb(new)->>'status') else '{}'::jsonb end);return new;
end$$;
create trigger audit_candidate_records after insert or update on public.candidates for each row execute function public.audit_organization_record();
create trigger audit_agency_clients after insert or update on public.agency_clients for each row execute function public.audit_organization_record();
create trigger audit_reward_entries after insert or update on public.reward_entries for each row execute function public.audit_organization_record();
commit;
