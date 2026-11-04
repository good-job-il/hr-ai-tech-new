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

reset role;
update auth.users set email_confirmed_at=now() where id='a5110000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','a5110000-0000-4000-8000-000000000001',true);
select set_client_hourly_fee(current_setting('hh.pilot_client')::uuid,22);
select set_client_portal_member(current_setting('hh.pilot_client')::uuid,'pilot-b@example.invalid',true);
do $$declare sid uuid;begin select id into strict sid from candidate_submissions where placement_id=current_setting('hh.pilot_placement')::uuid and status='sent';perform set_config('hh.pilot_presentation',share_candidate_portal(sid,'Synthetic approved professional summary')::text,true);end$$;
select save_placement_employment(current_setting('hh.pilot_placement')::uuid,'2025-01-01','2025-02-15',0);
select save_placement_work_period(current_setting('hh.pilot_placement')::uuid,1,35,160,true);
select save_placement_work_period(current_setting('hh.pilot_placement')::uuid,2,35,80,true);
do $$declare d jsonb;begin d:=placement_pilot_details(current_setting('hh.pilot_placement')::uuid);if not exists(select 1 from jsonb_array_elements(d->'periods') p where (p->>'month_number')::int=2 and (p->>'estimated_amount')::numeric=616 and (p->>'eligible')::boolean) then raise exception 'PARTIAL_MONTH_FEE_FAILED';end if;end$$;
select set_config('request.jwt.claim.sub','a5110000-0000-4000-8000-000000000002',true);
do $$declare d jsonb;begin d:=client_portal_data();if jsonb_array_length(d->'presentations')<>1 or d::text like '%Agency screening notes%' then raise exception 'PORTAL_SCOPE_FAILED';end if;end$$;
select submit_client_feedback(current_setting('hh.pilot_presentation')::uuid,'interview','Synthetic client feedback',now()+interval '2 days');
select set_config('request.jwt.claim.sub','a5110000-0000-4000-8000-000000000001',true);
do $$declare d jsonb;begin d:=placement_pilot_details(current_setting('hh.pilot_placement')::uuid);if d#>>'{presentations,0,feedback,0,note}'<>'Synthetic client feedback' then raise exception 'FEEDBACK_DELIVERY_FAILED';end if;end$$;
select set_client_sharing_policy(current_setting('hh.pilot_client')::uuid,true,'client');
do $$declare sid uuid;begin select id into sid from candidate_submissions where placement_id=current_setting('hh.pilot_placement')::uuid;perform share_candidate_portal(sid,'Accounting experience',null,true);end$$;
select set_config('request.jwt.claim.sub','a5110000-0000-4000-8000-000000000002',true);
do $$declare d jsonb;begin d:=client_portal_data();if d::text like '%SYNTHETIC CANDIDATE%' or jsonb_array_length(d#>'{presentations,0,feedback}')<>0 or d#>>'{presentations,0,snapshot,anonymous}'<>'true' then raise exception 'ANONYMITY_FAILED';end if;end$$;
select submit_client_feedback(current_setting('hh.pilot_presentation')::uuid,'interview_scheduled','Confirmed appointment',now()+interval '4 days');
select request_client_portal_trial('Synthetic client','Synthetic agency');
select set_config('request.jwt.claim.sub','a5110000-0000-4000-8000-000000000001',true);
do $$begin if (select count(*) from placement_interviews where placement_id=current_setting('hh.pilot_placement')::uuid)<>2 then raise exception 'CLIENT_SCHEDULING_FAILED';end if;end$$;
select revoke_client_presentation(current_setting('hh.pilot_presentation')::uuid);
select set_config('request.jwt.claim.sub','a5110000-0000-4000-8000-000000000002',true);
do $$begin if jsonb_array_length(client_portal_data()->'presentations')<>0 then raise exception 'REVOCATION_FAILED';end if;end$$;
rollback;
select 'PASS: anonymous privacy, scheduling, access request and isolated cloud workflow, scoped portal, feedback, revocation, start/end tracking, 22% actual-hour fees, partial month. All synthetic records rolled back.' as result;
