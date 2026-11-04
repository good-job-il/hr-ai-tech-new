-- Run only in ruejyiromtthygqtpcsy. All synthetic fixtures roll back.
rollback;
begin;
insert into auth.users(id,email) values('90000000-0000-4000-8000-000000000001','rls-owner@example.invalid'),('90000000-0000-4000-8000-000000000002','rls-outsider@example.invalid'),('90000000-0000-4000-8000-000000000003','rls-candidate@example.invalid');
insert into public.organizations(id,name,kind) values('91000000-0000-4000-8000-000000000001','ROLLBACK TEST A','agency'),('91000000-0000-4000-8000-000000000002','ROLLBACK TEST B','employer');
insert into public.memberships(organization_id,user_id,role) values('91000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','owner'),('91000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000002','owner');
insert into public.jobs(id,organization_id,title,location,description,type) values('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','ROLLBACK TEST','Test','Test','full-time');
insert into public.candidates(organization_id,owner_id,full_name,email,visibility) values('91000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','ROLLBACK TEST','test@example.invalid','personal');
set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000003',true);
insert into public.applications(job_id,candidate_id,cover_letter) values('92000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000003','ROLLBACK TEST');
do $$begin
 if (select count(*) from public.applications)<>1 then raise exception 'Candidate cannot read own application';end if;
 if (select count(*) from public.candidates)<>0 then raise exception 'Candidate private pool leak';end if;
 update public.applications set status='hired';if found then raise exception 'Candidate changed hiring decision';end if;
 begin
  insert into public.applications(job_id,candidate_id,cover_letter) values('92000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000003','Duplicate');
  raise exception 'Duplicate accepted';
 exception when unique_violation then null;end;
end$$;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000002',true);
do $$begin
 if (select count(*) from public.applications)<>0 then raise exception 'Cross-tenant application leak';end if;
 if (select count(*) from public.candidates)<>0 then raise exception 'Cross-tenant candidate leak';end if;
 update public.jobs set status='closed' where id='92000000-0000-4000-8000-000000000001';if found then raise exception 'Cross-tenant job mutation';end if;
end$$;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
do $$begin
 if (select count(*) from public.applications)<>1 then raise exception 'Owner cannot read application';end if;
 if (select count(*) from public.candidates)<>1 then raise exception 'Owner cannot read own pool';end if;
end$$;
update public.applications set status='interview' where id=(select id from public.applications where job_id='92000000-0000-4000-8000-000000000001');
insert into public.interviews(application_id,starts_at,notes) values((select id from public.applications where job_id='92000000-0000-4000-8000-000000000001'),now()+interval '1 day','ROLLBACK TEST');
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000003',true);
do $$begin if (select count(*) from public.interviews)<>1 then raise exception 'Candidate cannot read interview';end if;end$$;
select public.withdraw_application((select id from public.applications where job_id='92000000-0000-4000-8000-000000000001'));
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
do $$begin
 begin update public.applications set status='hired' where id=(select id from public.applications where job_id='92000000-0000-4000-8000-000000000001');raise exception 'WITHDRAWAL_NOT_PROTECTED';
 exception when others then if sqlerrm='WITHDRAWAL_NOT_PROTECTED' then raise;end if;end;
end$$;
rollback;
select 'PASS: real Supabase RLS, cross-tenant isolation, duplicates, interviews, withdrawal; all test data rolled back' as result;
