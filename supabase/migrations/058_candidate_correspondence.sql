begin;
create table public.organization_whatsapp_connections(
 organization_id uuid primary key references public.organizations,
 display_number text not null default '',phone_number_id text unique,
 status text not null default 'pending' check(status in('pending','ready','disabled')),
 requested_by uuid references auth.users,updated_at timestamptz not null default now()
);
create table public.candidate_internal_notes(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,
 candidate_id uuid not null references public.candidates,author_id uuid not null references auth.users,
 body text not null check(length(trim(body)) between 1 and 4000),created_at timestamptz not null default now()
);
create table public.candidate_whatsapp_messages(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,
 candidate_id uuid not null references public.candidates,author_id uuid references auth.users,
 direction text not null check(direction in('inbound','outbound')),
 body text not null check(length(trim(body)) between 1 and 4000),
 status text not null check(status in('draft','sending','sent','delivered','read','failed','unknown','received')),
 destination text not null,provider_id text unique,media_id text,media_type text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index candidate_whatsapp_history on public.candidate_whatsapp_messages(candidate_id,created_at desc);
create index candidate_notes_history on public.candidate_internal_notes(candidate_id,created_at desc);
create table public.whatsapp_unmatched_messages(
 provider_id text primary key,organization_id uuid not null references public.organizations,sender text not null,
 body text not null,received_at timestamptz not null,media_id text,media_type text,outgoing boolean not null default false
);
alter table public.organization_whatsapp_connections enable row level security;
alter table public.candidate_internal_notes enable row level security;
alter table public.candidate_whatsapp_messages enable row level security;
alter table public.whatsapp_unmatched_messages enable row level security;
revoke all on public.organization_whatsapp_connections,public.candidate_internal_notes,public.candidate_whatsapp_messages,public.whatsapp_unmatched_messages from public,anon,authenticated;

create function public.candidate_correspondence(candidate uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.candidates;begin
 select * into strict c from public.candidates where id=candidate;
 if not public.can_read_candidate(candidate) then raise exception 'NOT_PERMITTED';end if;
 return jsonb_build_object('candidate',jsonb_build_object('id',c.id,'name',c.full_name,'phone',c.phone,'headline',c.headline,'city',c.city,'region',c.region,'availability',c.availability),
 'roles',coalesce((select jsonb_agg(r.name) from public.candidate_interests i join public.career_roles r on r.id=i.role_id where i.candidate_id=c.id and i.active),'[]'::jsonb),
 'placements',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'job_title',j.title,'status',p.status)) from public.candidate_placements p join public.jobs j on j.id=p.job_id where p.candidate_id=c.id and public.can_manage_placement(p.id)),'[]'::jsonb),
 'connection',coalesce((select jsonb_build_object('status',w.status,'display_number',w.display_number) from public.organization_whatsapp_connections w where w.organization_id=c.organization_id),jsonb_build_object('status','not_connected','display_number','')),
 'can_write',public.org_capability(c.organization_id,'candidates.write'),
 'notes',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'body',n.body,'author',coalesce(nullif(a.full_name,''),'חבר צוות'),'created_at',n.created_at) order by n.created_at) from (select * from public.candidate_internal_notes n0 where n0.candidate_id=c.id order by n0.created_at desc limit 100) n left join public.account_settings a on a.user_id=n.author_id),'[]'::jsonb),
 'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'body',m.body,'direction',m.direction,'status',m.status,'created_at',m.created_at,'media_type',m.media_type,'editable',m.author_id=auth.uid() and m.status='draft') order by m.created_at) from (select * from public.candidate_whatsapp_messages m0 where m0.candidate_id=c.id and (m0.status<>'draft' or m0.author_id=auth.uid()) order by m0.created_at desc limit 100) m),'[]'::jsonb));
end$$;

create function public.add_candidate_internal_note(candidate uuid,note text) returns uuid language plpgsql security definer set search_path='' as $$declare c public.candidates;result uuid;begin
 select * into strict c from public.candidates where id=candidate;
 if not public.can_read_candidate(c.id) or not public.org_capability(c.organization_id,'candidates.write') then raise exception 'NOT_PERMITTED';end if;
 if length(trim(note)) not between 1 and 4000 then raise exception 'INVALID_NOTE';end if;
 insert into public.candidate_internal_notes(organization_id,candidate_id,author_id,body) values(c.organization_id,c.id,auth.uid(),trim(note)) returning id into result;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(c.organization_id,auth.uid(),'candidates',c.id,'internal_note_added',jsonb_build_object('note_id',result));return result;
end$$;

create function public.save_candidate_whatsapp_draft(candidate uuid,message text,draft uuid default null) returns uuid language plpgsql security definer set search_path='' as $$declare c public.candidates;result uuid;begin
 select * into strict c from public.candidates where id=candidate;
 if not public.can_read_candidate(c.id) or not public.org_capability(c.organization_id,'candidates.write') then raise exception 'NOT_PERMITTED';end if;
 if length(trim(message)) not between 1 and 4000 then raise exception 'INVALID_MESSAGE';end if;
 if draft is null then insert into public.candidate_whatsapp_messages(organization_id,candidate_id,author_id,direction,body,status,destination) values(c.organization_id,c.id,auth.uid(),'outbound',trim(message),'draft',coalesce(c.phone,'')) returning id into result;
 else update public.candidate_whatsapp_messages set body=trim(message),destination=coalesce(c.phone,''),updated_at=now() where id=draft and candidate_id=c.id and author_id=auth.uid() and status='draft' returning id into result;if result is null then raise exception 'DRAFT_NOT_EDITABLE';end if;end if;return result;
end$$;

create function public.organization_whatsapp_settings(org uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not public.org_capability(org,'organization.manage') then raise exception 'NOT_PERMITTED';end if;
 return jsonb_build_object('connection',coalesce((select jsonb_build_object('status',w.status,'display_number',w.display_number) from public.organization_whatsapp_connections w where w.organization_id=org),jsonb_build_object('status','not_connected','display_number','')),'unmatched',(select count(*) from public.whatsapp_unmatched_messages where organization_id=org));
end$$;
create function public.request_organization_whatsapp(org uuid,phone text) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.org_capability(org,'organization.manage') then raise exception 'NOT_PERMITTED';end if;
 if not public.valid_account_phone(phone) then raise exception 'INVALID_PHONE';end if;
 insert into public.organization_whatsapp_connections(organization_id,display_number,requested_by) values(org,trim(phone),auth.uid()) on conflict(organization_id) do update set display_number=excluded.display_number,requested_by=auth.uid(),updated_at=now() where public.organization_whatsapp_connections.status<>'ready';
 if not found then raise exception 'CONNECTED_NUMBER_REQUIRES_CONTROLLED_CHANGE';end if;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(org,auth.uid(),'organizations',org,'whatsapp_connection_requested','{}');
end$$;

-- The sending path has no access to the internal-note table, and accepts only a saved outbound draft.
create function public.prepare_candidate_whatsapp_send(draft uuid,contact_permission boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.candidate_whatsapp_messages;c public.candidates;w public.organization_whatsapp_connections;begin
 select * into strict m from public.candidate_whatsapp_messages where id=draft for update;
 select * into strict c from public.candidates where id=m.candidate_id;
 if m.author_id<>auth.uid() or not public.can_read_candidate(c.id) or not public.org_capability(c.organization_id,'candidates.write') or m.status<>'draft' or m.direction<>'outbound' then raise exception 'NOT_PERMITTED';end if;
 if contact_permission is not true then raise exception 'CONTACT_PERMISSION_REQUIRED';end if;
 select * into w from public.organization_whatsapp_connections where organization_id=c.organization_id;
 if w.status is distinct from 'ready' or w.phone_number_id is null then raise exception 'WHATSAPP_NOT_CONNECTED';end if;
 if not public.valid_account_phone(c.phone) or c.phone is distinct from m.destination then raise exception 'RECIPIENT_CHANGED_OR_INVALID';end if;
 if not exists(select 1 from public.candidate_whatsapp_messages i where i.candidate_id=c.id and i.direction='inbound' and i.created_at>now()-interval '24 hours' and public.normalize_candidate_phone(i.destination)=public.normalize_candidate_phone(m.destination)) then raise exception 'TEMPLATE_REQUIRED_OUTSIDE_WINDOW';end if;
 update public.candidate_whatsapp_messages set status='sending',updated_at=now() where id=m.id;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(c.organization_id,auth.uid(),'candidates',c.id,'whatsapp_send_requested',jsonb_build_object('message_id',m.id,'contact_permission_confirmed',true));
 return jsonb_build_object('id',m.id,'organization_id',c.organization_id,'phone_number_id',w.phone_number_id,'destination',m.destination,'body',m.body);
end$$;

-- Service-only entry points; tokens and app secrets are kept outside these public tables.
create function public.activate_organization_whatsapp(org uuid,phone_id text,display_phone text) returns void language plpgsql security definer set search_path='' as $$begin
 if phone_id !~ '^[0-9]{5,40}$' or not public.valid_account_phone(display_phone) then raise exception 'INVALID_CONNECTION';end if;
 insert into public.organization_whatsapp_connections(organization_id,display_number,phone_number_id,status) values(org,display_phone,phone_id,'ready') on conflict(organization_id) do update set display_number=excluded.display_number,phone_number_id=excluded.phone_number_id,status='ready',updated_at=now();
end$$;
create function public.finish_whatsapp_send(message uuid,provider text,result text) returns void language plpgsql security definer set search_path='' as $$begin
 if result not in('sent','failed','unknown') then raise exception 'INVALID_RESULT';end if;
 if result='sent' and coalesce(length(provider),0)=0 then raise exception 'PROVIDER_ID_REQUIRED';end if;
 update public.candidate_whatsapp_messages set status=result,provider_id=nullif(provider,''),updated_at=now() where id=message and status='sending';
end$$;
create function public.receive_whatsapp_message(phone_id text,provider text,sender text,message text,received_at timestamptz,media text default null,media_kind text default null,outgoing boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare org uuid;cid uuid;matches integer;stamp timestamptz;begin
 select organization_id into org from public.organization_whatsapp_connections where phone_number_id=phone_id and status='ready';if org is null then raise exception 'UNKNOWN_CONNECTION';end if;
 if length(provider) not between 1 and 300 or length(message) not between 1 and 4000 or received_at>now()+interval '5 minutes' then raise exception 'INVALID_EVENT';end if;
 if exists(select 1 from public.candidate_whatsapp_messages where provider_id=provider) or exists(select 1 from public.whatsapp_unmatched_messages where provider_id=provider) then return;end if;
 select count(*),(array_agg(c.id))[1] into matches,cid from public.candidates c where c.organization_id=org and c.merged_into is null and public.normalize_candidate_phone(c.phone)=public.normalize_candidate_phone(sender) and public.valid_account_phone(sender);
 stamp:=coalesce(received_at,now());
 if matches=1 then insert into public.candidate_whatsapp_messages(organization_id,candidate_id,direction,body,status,destination,provider_id,media_id,media_type,created_at) values(org,cid,case when outgoing then 'outbound' else 'inbound' end,message,case when outgoing then 'sent' else 'received' end,sender,provider,media,media_kind,stamp) on conflict(provider_id) do nothing;
 else insert into public.whatsapp_unmatched_messages values(provider,org,sender,message,stamp,media,media_kind,outgoing) on conflict(provider_id) do nothing;end if;
end$$;
create function public.receive_whatsapp_status(phone_id text,provider text,event_status text) returns void language plpgsql security definer set search_path='' as $$begin
 if event_status not in('sent','delivered','read','failed') then return;end if;
 update public.candidate_whatsapp_messages m set status=event_status,updated_at=now() from public.organization_whatsapp_connections w where m.organization_id=w.organization_id and w.phone_number_id=phone_id and w.status='ready' and m.provider_id=provider and m.direction='outbound' and (event_status='read' or (event_status='delivered' and m.status<>'read') or (event_status='sent' and m.status in('sending','unknown')) or (event_status='failed' and m.status in('sending','sent','unknown')));
end$$;
revoke all on function public.candidate_correspondence(uuid),public.add_candidate_internal_note(uuid,text),public.save_candidate_whatsapp_draft(uuid,text,uuid),public.organization_whatsapp_settings(uuid),public.request_organization_whatsapp(uuid,text),public.prepare_candidate_whatsapp_send(uuid,boolean),public.activate_organization_whatsapp(uuid,text,text),public.finish_whatsapp_send(uuid,text,text),public.receive_whatsapp_message(text,text,text,text,timestamptz,text,text,boolean),public.receive_whatsapp_status(text,text,text) from public,anon,authenticated;
grant execute on function public.candidate_correspondence(uuid),public.add_candidate_internal_note(uuid,text),public.save_candidate_whatsapp_draft(uuid,text,uuid),public.organization_whatsapp_settings(uuid),public.request_organization_whatsapp(uuid,text),public.prepare_candidate_whatsapp_send(uuid,boolean) to authenticated;
grant execute on function public.activate_organization_whatsapp(uuid,text,text),public.finish_whatsapp_send(uuid,text,text),public.receive_whatsapp_message(text,text,text,text,timestamptz,text,text,boolean),public.receive_whatsapp_status(text,text,text) to service_role;
commit;
