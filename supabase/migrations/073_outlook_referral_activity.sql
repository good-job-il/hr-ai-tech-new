begin;

-- A delivery references the exact existing client presentation, not an email subject
-- or a candidate's name. The recorded recipient is the address authorized at send time.
create table public.outlook_referral_deliveries (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.client_presentations(id),
  privacy_version integer not null,
  sent_by uuid not null references auth.users(id),
  mailbox text not null check(mailbox=lower(trim(mailbox)) and length(mailbox) between 3 and 254),
  recipient text not null check(recipient=lower(trim(recipient)) and length(recipient) between 3 and 254),
  requested_at timestamptz not null default now(),
  accepted_at timestamptz,
  provider_message_id text check(length(provider_message_id) between 3 and 998),
  unique (id, mailbox),
  unique (mailbox, provider_message_id),
  unique (presentation_id, privacy_version, recipient)
);

create table public.outlook_referral_replies (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null,
  mailbox text not null,
  provider_message_id text not null check(length(provider_message_id) between 3 and 998),
  received_at timestamptz not null,
  body text not null check(length(body) between 1 and 12000),
  foreign key (delivery_id, mailbox) references public.outlook_referral_deliveries(id, mailbox),
  unique (mailbox, provider_message_id)
);

alter table public.outlook_referral_deliveries enable row level security;
alter table public.outlook_referral_replies enable row level security;
revoke all on public.outlook_referral_deliveries, public.outlook_referral_replies from public,anon,authenticated;
grant select,insert,update on public.outlook_referral_deliveries to service_role;
grant select,insert on public.outlook_referral_replies to service_role;

alter function public.candidate_activity_rows(uuid) rename to candidate_activity_rows_without_outlook;

create function public.candidate_activity_rows(candidate uuid)
returns table(id text,source text,kind text,title text,occurred_at timestamptz,source_date_text text,
 author_label text,body text,job_key text,job_label text,client_label text,document_id uuid)
language sql stable security definer set search_path='' as $$
  select * from public.candidate_activity_rows_without_outlook(candidate)
  union all
  select 'outlook:'||r.id,'native','outlook_reply','',r.received_at,'',
    cl.name,r.body,j.id::text,j.title,cl.name,null::uuid
  from public.outlook_referral_replies r
  join public.outlook_referral_deliveries d on d.id=r.delivery_id
  join public.client_presentations pr on pr.id=d.presentation_id
  join public.candidate_placements p on p.id=pr.placement_id
  join public.jobs j on j.id=p.job_id
  join public.agency_clients cl on cl.id=pr.client_id and cl.organization_id=p.organization_id
  where p.candidate_id=candidate and public.can_manage_placement(p.id)
    and d.accepted_at is not null and d.provider_message_id is not null
$$;

revoke all on function public.candidate_activity_rows(uuid) from public,anon,authenticated;

commit;
