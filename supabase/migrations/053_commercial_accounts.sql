begin;
-- Monetary balances are distinct from prepaid application allowances. No payment provider or automatic collection.
create function public.can_read_commercial(org uuid) returns boolean language sql stable security definer set search_path='' as $$select public.is_platform_admin() or public.has_role(org,array['owner','org_admin','finance'])$$;
create table public.commercial_accounts(organization_id uuid primary key references public.organizations,plan text not null default 'trial' check(plan in('trial','solo','team','organization')),trial_until timestamptz,money_agorot bigint not null default 0 check(money_agorot>=0),application_balance integer not null default 0 check(application_balance>=0),monthly_price_agorot integer check(monthly_price_agorot>=0),auto_renew boolean not null default false check(not auto_renew),created_at timestamptz not null default now());
create table public.commercial_events(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,actor_id uuid references auth.users,event_type text not null check(event_type in('trial_extension','application_gift','plan_change','payment_verified','application_debit','application_credit')),application_delta integer not null default 0,money_delta_agorot bigint not null default 0,reason text not null check(length(trim(reason)) between 1 and 1000),details jsonb not null default '{}',request_key uuid not null unique,created_at timestamptz not null default now());
create index commercial_events_org_date on public.commercial_events(organization_id,created_at desc,id);
create table public.commercial_trial_notices(organization_id uuid not null references public.organizations,user_id uuid not null references auth.users,trial_until timestamptz not null,days_before integer not null check(days_before in(10,5,2,1)),created_at timestamptz not null default now(),primary key(organization_id,user_id,trial_until,days_before));
alter table public.commercial_accounts enable row level security;
alter table public.commercial_events enable row level security;
alter table public.commercial_trial_notices enable row level security;
create policy commercial_accounts_read on public.commercial_accounts for select to authenticated using(public.can_read_commercial(organization_id));
create policy commercial_events_read on public.commercial_events for select to authenticated using(public.can_read_commercial(organization_id));
create policy commercial_notices_read on public.commercial_trial_notices for select to authenticated using(user_id=auth.uid() and public.can_read_commercial(organization_id));
revoke all on public.commercial_accounts,public.commercial_events,public.commercial_trial_notices from public,anon,authenticated;
grant select on public.commercial_accounts,public.commercial_events,public.commercial_trial_notices to authenticated;

create function public.adjust_commercial_account(org uuid,days_count integer,period_unit text,gift_count integer,reason text,request_key uuid) returns void language plpgsql security definer set search_path='' as $$declare until_date timestamptz;base_date timestamp;prior public.commercial_events;begin
 if not public.is_platform_admin() then raise exception 'Not permitted';end if;
 if days_count is null or gift_count is null or days_count<0 or days_count>3650 or gift_count<0 or gift_count>100000 or (days_count=0 and gift_count=0) or period_unit is null or period_unit not in('days','weeks','months') or length(trim(reason)) not between 1 and 1000 or reason is null or request_key is null then raise exception 'INVALID_ADJUSTMENT';end if;
 perform pg_advisory_xact_lock(hashtextextended(request_key::text,0));
 select * into prior from public.commercial_events e where e.request_key=adjust_commercial_account.request_key;
 if found then
  if prior.organization_id<>org or prior.reason<>trim(reason) or prior.details->>'duration'<>days_count::text or prior.details->>'unit'<>period_unit or prior.details->>'gift'<>gift_count::text then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return;
 end if;
 insert into public.commercial_accounts(organization_id) values(org) on conflict do nothing;
 select trial_until into until_date from public.commercial_accounts where organization_id=org for update;
 base_date:=greatest(coalesce(until_date,now()),now()) at time zone 'Asia/Jerusalem';
 if days_count>0 then until_date:=(base_date+case period_unit when 'days' then make_interval(days=>days_count) when 'weeks' then make_interval(days=>days_count*7) else make_interval(months=>days_count) end) at time zone 'Asia/Jerusalem';end if;
 update public.commercial_accounts set trial_until=until_date,application_balance=application_balance+gift_count where organization_id=org;
 insert into public.commercial_events(organization_id,actor_id,event_type,application_delta,reason,details,request_key) values(org,auth.uid(),case when days_count>0 then 'trial_extension' else 'application_gift' end,gift_count,trim(reason),jsonb_build_object('duration',days_count,'unit',period_unit,'gift',gift_count,'trial_until',until_date),request_key);
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(org,auth.uid(),'commercial_accounts',org,'commercial_benefit',jsonb_build_object('duration',days_count,'unit',period_unit,'gift',gift_count,'reason',trim(reason)));
end$$;

create function public.commercial_overview() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not public.is_platform_admin() then raise exception 'Not permitted';end if;
 return jsonb_build_object('organizations',coalesce((select jsonb_agg(to_jsonb(x)) from (select o.id,o.name,o.kind,a.plan,a.trial_until,coalesce(a.money_agorot,0) money_agorot,coalesce(a.application_balance,0) application_balance,a.monthly_price_agorot from public.organizations o left join public.commercial_accounts a on a.organization_id=o.id order by o.name,o.id)x),'[]'),
 'received_agorot',coalesce((select sum(money_delta_agorot) from public.commercial_events where event_type='payment_verified' and created_at>=date_trunc('month',now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem'),0),
 'applications_debited',coalesce((select -sum(application_delta) from public.commercial_events where event_type='application_debit' and created_at>=date_trunc('month',now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem'),0));
end$$;

create function public.commercial_account_data(org uuid,event_page integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not public.can_read_commercial(org) then raise exception 'Not permitted';end if;
 if event_page is null or event_page<0 then raise exception 'INVALID_PAGE';end if;
 return jsonb_build_object('account',(select to_jsonb(a) from public.commercial_accounts a where organization_id=org),'count',(select count(*) from public.commercial_events where organization_id=org),'events',coalesce((select jsonb_agg(to_jsonb(x)) from (select id,event_type,application_delta,money_delta_agorot,reason,details,created_at from public.commercial_events where organization_id=org order by created_at desc,id limit 25 offset event_page*25)x),'[]'));
end$$;

create function public.commercial_trial_reminder(org uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare a public.commercial_accounts;remaining integer;threshold integer;begin
 if not public.can_read_commercial(org) then raise exception 'Not permitted';end if;
 select * into a from public.commercial_accounts where organization_id=org;
 if not found or a.plan<>'trial' or a.trial_until is null then return null;end if;
 -- A candidate quota is not money. Only a known sufficient continuation price suppresses expiry reminders.
 if a.monthly_price_agorot>0 and a.money_agorot>=a.monthly_price_agorot then return null;end if;
 remaining:=(a.trial_until at time zone 'Asia/Jerusalem')::date-(now() at time zone 'Asia/Jerusalem')::date;
 if remaining not between 0 and 10 then return null;end if;
 threshold:=case when remaining<=1 then 1 when remaining<=2 then 2 when remaining<=5 then 5 else 10 end;
 insert into public.commercial_trial_notices(organization_id,user_id,trial_until,days_before) values(org,auth.uid(),a.trial_until,threshold) on conflict do nothing;
 return jsonb_build_object('days_remaining',remaining,'trial_until',a.trial_until,'threshold',threshold);
end$$;
revoke all on function public.can_read_commercial(uuid),public.adjust_commercial_account(uuid,integer,text,integer,text,uuid),public.commercial_overview(),public.commercial_account_data(uuid,integer),public.commercial_trial_reminder(uuid) from public,anon;
grant execute on function public.can_read_commercial(uuid),public.adjust_commercial_account(uuid,integer,text,integer,text,uuid),public.commercial_overview(),public.commercial_account_data(uuid,integer),public.commercial_trial_reminder(uuid) to authenticated;
commit;
