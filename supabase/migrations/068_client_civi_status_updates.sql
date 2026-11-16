begin;

-- Enable only for an explicitly selected agency, never every tenant by inference.
create function public.configure_client_civi_reasons(agency uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.org_capability(agency,'organization.manage') or not exists(select 1 from public.organizations where id=agency and kind='agency') then raise exception 'Not permitted';end if;
 insert into public.organization_rejection_reasons(organization_id,label,label_en,sort_order)
 select agency,v.label,v.en,v.position from(values
 (1,'שעות עבודה','Working hours'),(2,'ימי עבודה','Working days'),(3,'שכר','Salary'),(4,'סוג משרה','Job type'),(5,'השכלה','Education'),(6,'ניסיון חסר','Insufficient experience'),(7,'ניסיון יתר','Overqualified'),(9,'מרחק','Distance'),(10,'ניידות','Mobility'),(13,'לא מתאים','Not suitable'),(17,'לא עבר ראיון','Interview not passed'),(19,'רישיון לא מתאים','Required license not met'),(20,'המשרה אוישה','Position filled'),(21,'ידע מקצועי','Professional knowledge'))v(position,label,en)
 on conflict(organization_id,label) do update set active=true,label_en=excluded.label_en,sort_order=excluded.sort_order;
 -- Explicitly exclude the rejected categories and follow-up states from decisions.
 update public.organization_rejection_reasons set active=false where organization_id=agency and label in('גילאים','מגזר','יחזור אם יתאים לו','אינו זמין בטלפון','מועמד מוכר','עדיפות שניה','עובד/ת');
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action) values(agency,auth.uid(),'organizations',agency,'client_civi_reasons_configured');
end$$;
revoke all on function public.configure_client_civi_reasons(uuid) from public,anon;
grant execute on function public.configure_client_civi_reasons(uuid) to authenticated;

create table public.client_presentation_updates(
 id uuid primary key,
 presentation_id uuid not null references public.client_presentations,
 share_revision integer not null check(share_revision>0),
 actor_id uuid not null references auth.users,
 status_code text not null check(status_code in('follow_up','unreachable','known','second_choice','employed')),
 label text not null,
 note text not null default '' check(length(note)<=4000),
 created_at timestamptz not null default now()
);
alter table public.client_presentation_updates enable row level security;
revoke all on public.client_presentation_updates from public,anon,authenticated;

create function public.submit_client_portal_update(presentation uuid,expected_revision integer,request_id uuid,status_code text,update_note text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.client_presentations;org uuid;label text;u public.client_presentation_updates;
begin
 select * into strict s from public.client_presentations where id=presentation for update;
 if not public.can_view_client_presentation(presentation) then raise exception 'Not permitted';end if;
 if expected_revision is distinct from s.share_revision then raise exception 'REFERRAL_UPDATED';end if;
 if request_id is null or update_note is null or length(update_note)>4000 then raise exception 'INVALID_UPDATE';end if;
 label:=case status_code when 'follow_up' then 'יחזור אם יתאים לו' when 'unreachable' then 'אינו זמין בטלפון' when 'known' then 'מועמד מוכר' when 'second_choice' then 'עדיפות שניה' when 'employed' then 'עובד/ת' end;
 if label is null then raise exception 'INVALID_UPDATE';end if;
 select * into u from public.client_presentation_updates where id=request_id;
 if found then
  if u.presentation_id<>presentation or u.actor_id<>auth.uid() or u.share_revision<>expected_revision or u.status_code<>submit_client_portal_update.status_code or u.note<>update_note then raise exception 'INVALID_REQUEST_ID';end if;
 else
  insert into public.client_presentation_updates(id,presentation_id,share_revision,actor_id,status_code,label,note) values(request_id,presentation,expected_revision,auth.uid(),status_code,label,update_note) returning * into u;
  select organization_id into strict org from public.agency_clients where id=s.client_id;
  insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(org,auth.uid(),'candidate_placements',s.placement_id,'client_status_update_received',jsonb_build_object('status',status_code));
 end if;
 return jsonb_build_object('id',u.id,'status_code',u.status_code,'label',u.label,'note',u.note,'created_at',u.created_at);
end$$;
revoke all on function public.submit_client_portal_update(uuid,integer,uuid,text,text) from public,anon;
grant execute on function public.submit_client_portal_update(uuid,integer,uuid,text,text) to authenticated;

alter function public.client_portal_data() rename to client_portal_data_before_updates;
revoke all on function public.client_portal_data_before_updates() from public,anon,authenticated;
create function public.client_portal_data() returns jsonb language plpgsql stable security definer set search_path='' as $$declare payload jsonb;begin
 payload:=public.client_portal_data_before_updates();
 return payload||jsonb_build_object('schema_version',3,'presentations',coalesce((select jsonb_agg(p||jsonb_build_object('status_updates',coalesce((select jsonb_agg(x.value order by x.created_at desc,x.id) from(select u.id,u.created_at,jsonb_build_object('id',u.id,'status_code',u.status_code,'label',u.label,'note',u.note,'created_at',u.created_at) value from public.client_presentation_updates u where u.presentation_id=(p->>'id')::uuid and u.share_revision=(p->>'share_revision')::integer order by u.created_at desc,u.id limit 20)x),'[]'::jsonb)) order by (p->>'shared_at')::timestamptz desc,p->>'id') from jsonb_array_elements(payload->'presentations')p),'[]'::jsonb));
end$$;
revoke all on function public.client_portal_data() from public,anon;
grant execute on function public.client_portal_data() to authenticated;

alter function public.placement_pilot_details(uuid) rename to placement_pilot_details_before_updates;
revoke all on function public.placement_pilot_details_before_updates(uuid) from public,anon,authenticated;
create function public.placement_pilot_details(placement uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare payload jsonb;begin
 payload:=public.placement_pilot_details_before_updates(placement);
 return payload||jsonb_build_object('presentations',coalesce((select jsonb_agg(p||jsonb_build_object('status_updates',coalesce((select jsonb_agg(x.value order by x.created_at desc,x.id) from(select u.id,u.created_at,jsonb_build_object('id',u.id,'status_code',u.status_code,'label',u.label,'note',u.note,'created_at',u.created_at,'share_revision',u.share_revision) value from public.client_presentation_updates u where u.presentation_id=(p->>'id')::uuid order by u.created_at desc,u.id limit 50)x),'[]'::jsonb))) from jsonb_array_elements(payload->'presentations')p),'[]'::jsonb));
end$$;
revoke all on function public.placement_pilot_details(uuid) from public,anon;
grant execute on function public.placement_pilot_details(uuid) to authenticated;
commit;
