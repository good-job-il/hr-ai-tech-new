rollback;begin;
insert into auth.users(id,email,email_confirmed_at) values
('98000000-0000-4000-8000-000000000001','hierarchy-owner@example.invalid',now()),
('98000000-0000-4000-8000-000000000002','hierarchy-manager@example.invalid',now()),
('98000000-0000-4000-8000-000000000003','hierarchy-lead@example.invalid',now()),
('98000000-0000-4000-8000-000000000004','hierarchy-coordinator@example.invalid',now()),
('98000000-0000-4000-8000-000000000005','hierarchy-other-coordinator@example.invalid',now()),
('98000000-0000-4000-8000-000000000006','hierarchy-employer@example.invalid',now()),
('98000000-0000-4000-8000-000000000007','hierarchy-hr@example.invalid',now()),
('98000000-0000-4000-8000-000000000008','hierarchy-invited@example.invalid',now());
set local role authenticated;
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000001',true);
select set_config('hh.hierarchy_org',public.create_organization('ROLLBACK hierarchy agency','agency')::text,true);
select public.set_member_role(current_setting('hh.hierarchy_org')::uuid,'98000000-0000-4000-8000-000000000002','recruitment_manager');
select public.set_member_role(current_setting('hh.hierarchy_org')::uuid,'98000000-0000-4000-8000-000000000003','team_lead');
select public.set_member_role(current_setting('hh.hierarchy_org')::uuid,'98000000-0000-4000-8000-000000000004','recruitment_coordinator');
select public.set_member_role(current_setting('hh.hierarchy_org')::uuid,'98000000-0000-4000-8000-000000000005','recruitment_coordinator');
select public.configure_member(current_setting('hh.hierarchy_org')::uuid,'98000000-0000-4000-8000-000000000003','98000000-0000-4000-8000-000000000002',true);
select public.configure_member(current_setting('hh.hierarchy_org')::uuid,'98000000-0000-4000-8000-000000000004','98000000-0000-4000-8000-000000000003',true);
select public.configure_member(current_setting('hh.hierarchy_org')::uuid,'98000000-0000-4000-8000-000000000005','98000000-0000-4000-8000-000000000002',true);
select set_config('hh.hierarchy_invite',public.create_team_invite(current_setting('hh.hierarchy_org')::uuid,'hierarchy-invited@example.invalid','recruitment_coordinator',null),true);
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000004',true);
with c as(insert into public.candidates(organization_id,owner_id,full_name,email,visibility) values(current_setting('hh.hierarchy_org')::uuid,auth.uid(),'ROLLBACK own team','hierarchy-a@fixture.test','personal') returning id) select set_config('hh.hierarchy_candidate',id::text,true) from c;
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000005',true);
insert into public.candidates(organization_id,owner_id,full_name,email,visibility) values(current_setting('hh.hierarchy_org')::uuid,auth.uid(),'ROLLBACK other team','hierarchy-b@fixture.test','personal');
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000003',true);
do $$begin
 if (select count(*) from public.candidates where organization_id=current_setting('hh.hierarchy_org')::uuid)<>1 then raise exception 'TEAM_SCOPE_FAILED';end if;
 if public.org_capability(current_setting('hh.hierarchy_org')::uuid,'candidates.merge') then raise exception 'TEAM_LEAD_MERGE_BYPASS';end if;
 begin perform public.merge_candidates(current_setting('hh.hierarchy_candidate')::uuid,gen_random_uuid());raise exception 'MERGE_BYPASS';exception when others then if SQLERRM='MERGE_BYPASS' then raise;end if;end;
end$$;
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000006',true);
select set_config('hh.hierarchy_employer',public.create_organization('ROLLBACK hierarchy employer','employer')::text,true);
select public.set_member_role(current_setting('hh.hierarchy_employer')::uuid,'98000000-0000-4000-8000-000000000007','hr_manager');
insert into public.reward_policies values(current_setting('hh.hierarchy_employer')::uuid,'ROLLBACK policy',now());
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000007',true);
do $$begin if exists(select 1 from public.reward_policies where organization_id=current_setting('hh.hierarchy_employer')::uuid) or public.org_capability(current_setting('hh.hierarchy_employer')::uuid,'rewards.manage') then raise exception 'HR_REWARD_BYPASS';end if;if exists(select 1 from public.candidates where organization_id=current_setting('hh.hierarchy_org')::uuid) then raise exception 'TENANT_SCOPE_FAILED';end if;end$$;
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000006',true);
select public.set_member_permission(current_setting('hh.hierarchy_employer')::uuid,'98000000-0000-4000-8000-000000000007','rewards.manage',true);
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000007',true);
do $$begin if not public.org_capability(current_setting('hh.hierarchy_employer')::uuid,'rewards.manage') then raise exception 'HR_GRANT_FAILED';end if;end$$;
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000008',true);
select public.accept_team_invite(current_setting('hh.hierarchy_invite'));
do $$begin begin perform public.accept_team_invite(current_setting('hh.hierarchy_invite'));raise exception 'INVITE_REUSE';exception when others then if SQLERRM='INVITE_REUSE' then raise;end if;end;end$$;
select set_config('request.jwt.claim.sub','98000000-0000-4000-8000-000000000001',true);
select public.set_member_status(current_setting('hh.hierarchy_org')::uuid,'98000000-0000-4000-8000-000000000004','suspended');
do $$begin if (select visibility from public.candidates where id=current_setting('hh.hierarchy_candidate')::uuid)<>'personal' then raise exception 'SUSPENSION_CHANGED_VISIBILITY';end if;end$$;
select public.set_member_status(current_setting('hh.hierarchy_org')::uuid,'98000000-0000-4000-8000-000000000004','closed');
do $$begin if not exists(select 1 from public.candidates where id=current_setting('hh.hierarchy_candidate')::uuid and visibility='shared' and created_by='98000000-0000-4000-8000-000000000004') then raise exception 'CLOSURE_LOST_CANDIDATE_OR_CREATOR';end if;end$$;
rollback;
select 'PASS_HIERARCHY_TEAM_SCOPE_HR_GRANT_INVITATION_AND_LIFECYCLE_ALL_FIXTURES_ROLLED_BACK' as result;
