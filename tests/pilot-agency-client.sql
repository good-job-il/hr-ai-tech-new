-- Synthetic agency/client workflow. Every fixture is rolled back; no external delivery.
begin;
insert into auth.users(id,email) values
('a5110000-0000-4000-8000-000000000001','pilot-a@example.invalid'),
('a5110000-0000-4000-8000-000000000002','pilot-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','a5110000-0000-4000-8000-000000000001',true);
select set_config('hh.pilot_org',public.create_organization('ISOLATED PILOT CHECK','agency')::text,true);
reset role;
update public.organizations set is_test=true where id=current_setting('hh.pilot_org')::uuid;
set local role authenticated;
with c as(insert into public.agency_clients(organization_id,name,notes) values(current_setting('hh.pilot_org')::uuid,'SYNTHETIC CLIENT','No real client contacted') returning id) select set_config('hh.pilot_client',id::text,true) from c;
with j as(insert into public.jobs(organization_id,title,location,type,description,client_id) values(current_setting('hh.pilot_org')::uuid,'ISOLATED PILOT ROLE','TEST','full-time','Synthetic screening criteria',current_setting('hh.pilot_client')::uuid) returning id) select set_config('hh.pilot_job',id::text,true) from j;
with c as(insert into public.candidates(organization_id,owner_id,full_name,email,visibility) values(current_setting('hh.pilot_org')::uuid,auth.uid(),'SYNTHETIC CANDIDATE','pilot-candidate@example.invalid','shared') returning id) select set_config('hh.pilot_candidate',id::text,true) from c;
do $$begin
 begin insert into public.candidates(organization_id,owner_id,full_name,email,visibility) values(current_setting('hh.pilot_org')::uuid,auth.uid(),'SYNTHETIC DUPLICATE','pilot-candidate@example.invalid','shared');raise exception 'DUPLICATE_NOT_BLOCKED';exception when unique_violation then null;end;
end$$;
with p as(insert into public.candidate_placements(organization_id,candidate_id,job_id,created_by,notes) values(current_setting('hh.pilot_org')::uuid,current_setting('hh.pilot_candidate')::uuid,current_setting('hh.pilot_job')::uuid,auth.uid(),'Agency screening notes') returning id) select set_config('hh.pilot_placement',id::text,true) from p;
update public.candidate_placements set status='reviewing' where id=current_setting('hh.pilot_placement')::uuid;
insert into public.placement_interviews(placement_id,starts_at,notes) values(current_setting('hh.pilot_placement')::uuid,now()+interval '1 day','Synthetic internal screening interview');
update public.candidate_placements set status='interview' where id=current_setting('hh.pilot_placement')::uuid;
select public.request_candidate_submission(current_setting('hh.pilot_placement')::uuid);
do $$declare s uuid;begin
 select id into strict s from public.candidate_submissions where placement_id=current_setting('hh.pilot_placement')::uuid and status='approved';
 -- Only records an imagined manual hand-off in this rolled-back test. Sends no data.
 perform public.record_candidate_sent(s);
 if not exists(select 1 from public.candidate_submissions where id=s and status='sent' and sent_at is not null) then raise exception 'SUBMISSION_LOG_MISSING';end if;
end$$;
update public.candidate_placements set notes='Synthetic client feedback: suitable for offer',status='offer' where id=current_setting('hh.pilot_placement')::uuid;
update public.candidate_placements set status='hired' where id=current_setting('hh.pilot_placement')::uuid;
do $$begin
 if (select count(*) from public.placement_activity where placement_id=current_setting('hh.pilot_placement')::uuid)<>5 then raise exception 'STAGE_HISTORY_MISSING';end if;
 if not exists(select 1 from public.placement_interviews where placement_id=current_setting('hh.pilot_placement')::uuid) then raise exception 'INTERVIEW_MISSING';end if;
 if not exists(select 1 from public.management_audit where entity_id in(select id from public.candidate_submissions where placement_id=current_setting('hh.pilot_placement')::uuid) and action='manual_submission_recorded') then raise exception 'AUDIT_MISSING';end if;
end$$;
select set_config('request.jwt.claim.sub','a5110000-0000-4000-8000-000000000002',true);
do $$begin
 if exists(select 1 from public.agency_clients where id=current_setting('hh.pilot_client')::uuid) or exists(select 1 from public.candidates where id=current_setting('hh.pilot_candidate')::uuid) or exists(select 1 from public.candidate_placements where id=current_setting('hh.pilot_placement')::uuid) or exists(select 1 from public.placement_interviews where placement_id=current_setting('hh.pilot_placement')::uuid) or exists(select 1 from public.candidate_submissions where placement_id=current_setting('hh.pilot_placement')::uuid) then raise exception 'CROSS_ACCOUNT_LEAK';end if;
 begin perform public.request_candidate_submission(current_setting('hh.pilot_placement')::uuid);raise exception 'UNAUTHORIZED_SUBMISSION';exception when others then if sqlerrm='UNAUTHORIZED_SUBMISSION' then raise;end if;end;
end$$;
rollback;
select 'PASS: client, client job, candidate, duplicate prevention, placement, screening, interview, manual-send log, feedback notes, offer, hired, history, audit, outsider isolation. No external sending or portal tested; every fixture rolled back.' as result;
