-- Real isolated staging verification. Every fixture and temporary admin is rolled back.
rollback;begin;
insert into auth.users(id,email) values('93000000-0000-4000-8000-000000000001','workflow-candidate@example.invalid'),('93000000-0000-4000-8000-000000000002','workflow-outsider@example.invalid'),('93000000-0000-4000-8000-000000000003','workflow-admin@example.invalid');
insert into public.platform_admins values('93000000-0000-4000-8000-000000000003');
insert into public.job_sources values('rollback-workflows','ROLLBACK SOURCE','https://example.invalid');
insert into public.external_jobs(id,source_id,source_url,title,location,description,verified_at,verification_method,publication_status) values('94000000-0000-4000-8000-000000000001','rollback-workflows','https://example.invalid/rollback-workflows','ROLLBACK TEST','Test','Test content',now(),'public-html','published');
set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000001',true);
insert into public.saved_jobs(user_id,external_job_id) values('93000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001');
with created as (insert into public.applications(external_job_id,candidate_id,cover_letter) values('94000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','ROLLBACK TEST') returning id) select set_config('hh.test_app_id',id::text,true) from created;
insert into public.application_messages(application_id,author_id,body) values(current_setting('hh.test_app_id')::uuid,'93000000-0000-4000-8000-000000000001','ROLLBACK TEST MESSAGE');
do $$begin if (select count(*) from public.saved_jobs)<>1 then raise exception 'Saved job failed';end if;if (select count(*) from public.application_activity where application_id=current_setting('hh.test_app_id')::uuid)<>1 then raise exception 'Missing activity';end if;end$$;
select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000002',true);
do $$begin
 if exists(select 1 from public.saved_jobs) or exists(select 1 from public.application_messages where application_id=current_setting('hh.test_app_id')::uuid) or exists(select 1 from public.applications where id=current_setting('hh.test_app_id')::uuid) then raise exception 'PRIVATE_DATA_LEAK';end if;
 begin perform public.platform_overview();raise exception 'ADMIN_BYPASS';exception when others then if sqlerrm='ADMIN_BYPASS' then raise;end if;end;
 begin insert into public.application_messages(application_id,author_id,body) values(current_setting('hh.test_app_id')::uuid,'93000000-0000-4000-8000-000000000002','FORBIDDEN');raise exception 'MESSAGE_BYPASS';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000003',true);
insert into public.application_internal_notes(application_id,author_id,body) values(current_setting('hh.test_app_id')::uuid,auth.uid(),'ROLLBACK PRIVATE HANDLING NOTE');
do $$begin if (select count(*) from public.application_internal_notes where application_id=current_setting('hh.test_app_id')::uuid)<>1 then raise exception 'Handler note missing';end if;end$$;
update public.applications set status='interview' where id=current_setting('hh.test_app_id')::uuid;
insert into public.interviews(application_id,starts_at,notes) values(current_setting('hh.test_app_id')::uuid,now()+interval '1 day','ROLLBACK TEST');
select public.record_profile_view(current_setting('hh.test_app_id')::uuid);select public.record_profile_view(current_setting('hh.test_app_id')::uuid);
select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000001',true);
do $$begin
 if exists(select 1 from public.application_internal_notes where application_id=current_setting('hh.test_app_id')::uuid) then raise exception 'Candidate can read private handler notes';end if;
 if (select count(*) from public.notifications)<>2 then raise exception 'Notifications missing';end if;
 if (select count(*) from public.profile_views)<>1 then raise exception 'Views should be deduplicated';end if;
 if (select count(*) from public.interviews where application_id=current_setting('hh.test_app_id')::uuid)<>1 then raise exception 'Interview missing';end if;
end$$;
select public.withdraw_application(current_setting('hh.test_app_id')::uuid);
rollback;
select 'PASS: imported submission, private saved jobs/messages, admin isolation, interviews, activity, notifications and deduplicated views. All fixtures rolled back.' as result;
