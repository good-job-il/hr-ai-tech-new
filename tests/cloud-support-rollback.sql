-- Synthetic support acceptance. Only project rnstsczayhzrxzcstzpr; ROLLBACK mandatory.
begin;
insert into auth.users(id,email) values
('a5220000-0000-4000-8000-000000000001','support-requester@example.invalid'),
('a5220000-0000-4000-8000-000000000002','support-outsider@example.invalid'),
('a5220000-0000-4000-8000-000000000003','support-admin@example.invalid');
insert into public.platform_admins(user_id) values('a5220000-0000-4000-8000-000000000003');
set local role authenticated;
select set_config('request.jwt.claim.sub','a5220000-0000-4000-8000-000000000001',true);
insert into public.support_tickets(user_id,category,subject,body) values
(auth.uid(),'help','PILOT_SUPPORT_ROLLBACK_20261122','Synthetic request, no email sent');
do $$begin
 if (select count(*) from public.support_tickets where subject='PILOT_SUPPORT_ROLLBACK_20261122')<>1 then raise exception 'REQUESTER_READ_FAILED'; end if;
 update public.support_tickets set status='closed' where subject='PILOT_SUPPORT_ROLLBACK_20261122';
 if found then raise exception 'REQUESTER_CHANGED_STATUS'; end if;
 begin
  insert into public.support_tickets(user_id,category,subject,body) values('a5220000-0000-4000-8000-000000000002','help','Spoofed','Synthetic');
  raise exception 'SPOOFED_REQUEST_ACCEPTED';
 exception when insufficient_privilege then null; end;
end$$;
select set_config('request.jwt.claim.sub','a5220000-0000-4000-8000-000000000003',true);
do $$begin
 if (select count(*) from public.support_tickets where subject='PILOT_SUPPORT_ROLLBACK_20261122')<>1 then raise exception 'ADMIN_QUEUE_FAILED'; end if;
 update public.support_tickets set status='in_progress' where subject='PILOT_SUPPORT_ROLLBACK_20261122';
 if not found then raise exception 'ADMIN_STATUS_FAILED'; end if;
end$$;
insert into public.support_replies(ticket_id,author_id,body)
select id,auth.uid(),'Synthetic admin reply' from public.support_tickets where subject='PILOT_SUPPORT_ROLLBACK_20261122';
select set_config('request.jwt.claim.sub','a5220000-0000-4000-8000-000000000002',true);
do $$begin
 if exists(select 1 from public.support_tickets where subject='PILOT_SUPPORT_ROLLBACK_20261122') then raise exception 'OUTSIDER_TICKET_LEAK'; end if;
 if exists(select 1 from public.support_replies where author_id='a5220000-0000-4000-8000-000000000003') then raise exception 'OUTSIDER_REPLY_LEAK'; end if;
end$$;
select set_config('request.jwt.claim.sub','a5220000-0000-4000-8000-000000000001',true);
do $$begin
 if not exists(select 1 from public.support_tickets where subject='PILOT_SUPPORT_ROLLBACK_20261122' and status='in_progress') then raise exception 'REQUESTER_STATUS_READ_FAILED'; end if;
 if not exists(select 1 from public.support_replies r join public.support_tickets t on t.id=r.ticket_id where t.subject='PILOT_SUPPORT_ROLLBACK_20261122' and r.body='Synthetic admin reply') then raise exception 'REQUESTER_REPLY_READ_FAILED'; end if;
end$$;
rollback;
