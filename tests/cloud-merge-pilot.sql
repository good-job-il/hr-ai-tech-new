-- Disposable fixtures in HeadHunter Preview only. Always rolls back.
rollback;begin;
insert into auth.users(id,email) values('95000000-0000-4000-8000-000000000001','merge-owner@example.invalid'),('95000000-0000-4000-8000-000000000002','merge-outsider@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','95000000-0000-4000-8000-000000000001',true);
select set_config('hh.merge_org',public.create_organization('ROLLBACK merge pilot','agency')::text,true);
insert into public.jobs(id,organization_id,title,location,description,type) values('95000000-0000-4000-8000-000000000010',current_setting('hh.merge_org')::uuid,'ROLLBACK merge','Test','Rollback test','full-time');
insert into public.candidates(id,organization_id,owner_id,full_name,email,visibility) values
('95000000-0000-4000-8000-000000000011',current_setting('hh.merge_org')::uuid,auth.uid(),'Source','merge-source@example.invalid','shared'),
('95000000-0000-4000-8000-000000000012',current_setting('hh.merge_org')::uuid,auth.uid(),'Target','merge-target@example.invalid','shared');
with placed as (insert into public.candidate_placements(organization_id,candidate_id,job_id,created_by,notes) values(current_setting('hh.merge_org')::uuid,'95000000-0000-4000-8000-000000000011','95000000-0000-4000-8000-000000000010',auth.uid(),'Preserve notes') returning id) select set_config('hh.merge_placement',id::text,true) from placed;
update public.candidate_placements set status='interview' where id=current_setting('hh.merge_placement')::uuid;
insert into public.placement_interviews(placement_id,starts_at,notes) values(current_setting('hh.merge_placement')::uuid,now()+interval '1 day','Preserve interview');
select public.merge_candidates('95000000-0000-4000-8000-000000000011','95000000-0000-4000-8000-000000000012');
do $$begin
 if not exists(select 1 from public.candidate_placements where id=current_setting('hh.merge_placement')::uuid and candidate_id='95000000-0000-4000-8000-000000000012' and status='interview' and notes='Preserve notes') then raise exception 'Placement lost';end if;
 if (select count(*) from public.placement_activity where placement_id=current_setting('hh.merge_placement')::uuid)<>2 then raise exception 'History lost';end if;
 if (select count(*) from public.placement_interviews where placement_id=current_setting('hh.merge_placement')::uuid)<>1 then raise exception 'Interview lost';end if;
 if (select count(*) from public.merge_audit where source_id='95000000-0000-4000-8000-000000000011')<>1 then raise exception 'Audit lost';end if;
end$$;
select set_config('request.jwt.claim.sub','95000000-0000-4000-8000-000000000002',true);
do $$begin
 if exists(select 1 from public.candidate_placements where id=current_setting('hh.merge_placement')::uuid) or exists(select 1 from public.placement_interviews where placement_id=current_setting('hh.merge_placement')::uuid) or exists(select 1 from public.placement_activity where placement_id=current_setting('hh.merge_placement')::uuid) then raise exception 'Tenant leak';end if;
 begin perform public.merge_candidates('95000000-0000-4000-8000-000000000011','95000000-0000-4000-8000-000000000012');raise exception 'Unauthorized merge accepted';exception when others then if SQLERRM='Unauthorized merge accepted' then raise;end if;end;
end$$;
select set_config('request.jwt.claim.sub','95000000-0000-4000-8000-000000000001',true);
with ticket as (insert into public.support_tickets(user_id,category,subject,body) values(auth.uid(),'privacy','ROLLBACK privacy test','Synthetic fixture') returning id) select set_config('hh.support_ticket',id::text,true) from ticket;
insert into public.support_replies(ticket_id,author_id,body) values(current_setting('hh.support_ticket')::uuid,auth.uid(),'Private reply');
select set_config('request.jwt.claim.sub','95000000-0000-4000-8000-000000000002',true);
do $$begin if exists(select 1 from public.support_tickets where id=current_setting('hh.support_ticket')::uuid) or exists(select 1 from public.support_replies where ticket_id=current_setting('hh.support_ticket')::uuid) then raise exception 'Support privacy leak';end if;end$$;
rollback;
select 'PASS_CLOUD_MERGE_PRESERVES_PLACEMENT_HISTORY_INTERVIEW_SUPPORT_PRIVACY_AND_ISOLATION_ALL_FIXTURES_ROLLED_BACK' as result;
