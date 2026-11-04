begin;
create function public.request_client_portal_trial(client_name text,agency_name text) returns uuid language plpgsql security definer set search_path='' as $$declare ticket uuid;begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'VERIFIED_ACCOUNT_REQUIRED';end if;
 if length(trim(client_name)) not between 1 and 160 or length(trim(agency_name)) not between 1 and 160 then raise exception 'INVALID_REQUEST';end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 select id into ticket from public.support_tickets where user_id=auth.uid() and subject='בקשת הרשאה לפורטל לקוח — חודש התנסות' and status<>'closed' order by created_at desc limit 1;
 if ticket is not null then return ticket;end if;
 if (select count(*) from public.support_tickets where user_id=auth.uid() and subject='בקשת הרשאה לפורטל לקוח — חודש התנסות' and created_at>now()-interval '1 day')>=3 then raise exception 'REQUEST_LIMIT';end if;
 insert into public.support_tickets(user_id,category,subject,body) values(auth.uid(),'help','בקשת הרשאה לפורטל לקוח — חודש התנסות',concat('Client / לקוח: ',trim(client_name),E'\nAgency / חברת השמה: ',trim(agency_name),E'\nבקשת חודש התנסות לפורטל לקוח. נדרש אימות הקשר והרשאה מפורשת לפני גישה למועמדים. Request only; no access or billing activated.')) returning id into ticket;
 return ticket;
end$$;
revoke all on function public.request_client_portal_trial(text,text) from public,anon;
grant execute on function public.request_client_portal_trial(text,text) to authenticated;
commit;
