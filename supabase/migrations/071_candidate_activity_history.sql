begin;
create table public.candidate_source_links(
 organization_id uuid not null references public.organizations,
 source_system text not null check(source_system='civi'),source_candidate_id text not null,
 candidate_id uuid not null references public.candidates,
 primary key(organization_id,source_system,source_candidate_id)
);
alter table public.candidate_source_links enable row level security;
revoke all on public.candidate_source_links from public,anon,authenticated;
-- Historical source data never creates placements, presentations, messages or notifications.
create table public.candidate_source_events(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations,
 candidate_id uuid not null references public.candidates,
 source_system text not null default 'civi' check(source_system='civi'),
 source_candidate_id text not null check(length(source_candidate_id) between 1 and 160),
 source_event_key text not null check(length(source_event_key) between 1 and 256),
 source_kind text not null check(length(trim(source_kind)) between 1 and 240),
 occurred_at timestamptz not null,source_date_text text not null default '' check(length(source_date_text)<=160),
 author_label text not null default '' check(length(author_label)<=240),
 body text not null default '' check(length(body)<=100000),
 job_id uuid references public.jobs,job_label text not null default '' check(length(job_label)<=500),
 client_label text not null default '' check(length(client_label)<=500),
 source_job_id text not null default '' check(length(source_job_id)<=160),
 document_id uuid references public.candidate_documents,
 source_payload jsonb not null,imported_at timestamptz not null default now(),
 unique(organization_id,source_system,source_candidate_id,source_event_key)
);
create index candidate_source_events_history on public.candidate_source_events(candidate_id,occurred_at desc,id);
alter table public.candidate_source_events enable row level security;
revoke all on public.candidate_source_events from public,anon,authenticated;
grant select on public.candidate_source_events to authenticated;
create policy source_events_staff_read on public.candidate_source_events for select to authenticated
 using(public.is_member(organization_id) and public.can_read_candidate(candidate_id));

-- Trusted importer only. Source key conflicts and changed events stop instead of overwriting history.
create function public.import_candidate_source_events(candidate uuid,source_candidate text,events jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.candidates;r jsonb;payload jsonb;existing public.candidate_source_events;
 j uuid;d uuid;mapped uuid;inserted integer:=0;skipped integer:=0;new_id uuid;
begin
 select * into strict c from public.candidates where id=candidate and merged_into is null;
 if length(coalesce(source_candidate,'')) not between 1 and 160 or events is null or jsonb_typeof(events)<>'array' then raise exception 'INVALID_IMPORT';end if;
 if jsonb_array_length(events)>500 then raise exception 'INVALID_IMPORT';end if;
 insert into public.candidate_source_links values(c.organization_id,'civi',source_candidate,c.id) on conflict do nothing;
 select candidate_id into strict mapped from public.candidate_source_links where organization_id=c.organization_id and source_system='civi' and source_candidate_id=source_candidate;
 if mapped<>c.id then raise exception 'SOURCE_IDENTITY_CONFLICT';end if;
 for r in select value from jsonb_array_elements(events) loop
  if length(coalesce(r->>'key','')) not between 1 and 256 or length(trim(coalesce(r->>'kind',''))) not between 1 and 240
   or coalesce(r->>'occurred_at','')!~'([zZ]|[+-][0-9]{2}:[0-9]{2})$' then raise exception 'SOURCE_ID_AND_OFFSET_REQUIRED';end if;
  j:=nullif(r->>'job_id','')::uuid;d:=nullif(r->>'document_id','')::uuid;
  if j is not null and not exists(select 1 from public.jobs where id=j and organization_id=c.organization_id) then raise exception 'JOB_SCOPE_MISMATCH';end if;
  if d is not null and not exists(select 1 from public.candidate_documents where id=d and candidate_id=c.id and organization_id=c.organization_id) then raise exception 'DOCUMENT_SCOPE_MISMATCH';end if;
  payload:=jsonb_build_object('kind',r->>'kind','occurred_at',(r->>'occurred_at')::timestamptz,
   'source_date_text',coalesce(r->>'source_date_text',''),'author',coalesce(r->>'author',''),'body',coalesce(r->>'body',''),
   'job_id',j,'job_label',coalesce(r->>'job_label',''),'client_label',coalesce(r->>'client_label',''),
   'source_job_id',coalesce(r->>'source_job_id',''),'document_id',d);
  new_id:=null;
  insert into public.candidate_source_events(organization_id,candidate_id,source_candidate_id,source_event_key,source_kind,
   occurred_at,source_date_text,author_label,body,job_id,job_label,client_label,source_job_id,document_id,source_payload)
  values(c.organization_id,c.id,source_candidate,r->>'key',r->>'kind',(r->>'occurred_at')::timestamptz,
   payload->>'source_date_text',payload->>'author',payload->>'body',j,payload->>'job_label',payload->>'client_label',payload->>'source_job_id',d,payload)
  on conflict(organization_id,source_system,source_candidate_id,source_event_key) do nothing returning id into new_id;
  if new_id is null then
   select * into strict existing from public.candidate_source_events where organization_id=c.organization_id and source_system='civi' and source_candidate_id=source_candidate and source_event_key=r->>'key';
   if existing.candidate_id<>c.id then raise exception 'SOURCE_IDENTITY_CONFLICT';end if;
   if existing.source_payload<>payload then raise exception 'SOURCE_EVENT_CHANGED_REVIEW_REQUIRED';end if;
   skipped:=skipped+1;
  else inserted:=inserted+1;end if;
 end loop;
 return jsonb_build_object('inserted',inserted,'skipped',skipped);
end$$;
revoke all on function public.import_candidate_source_events(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.import_candidate_source_events(uuid,text,jsonb) to service_role;

-- Reusable row projection, private: original object paths, message recipients and source payload are never returned.
create function public.candidate_activity_rows(candidate uuid)
returns table(id text,source text,kind text,title text,occurred_at timestamptz,source_date_text text,
 author_label text,body text,job_key text,job_label text,client_label text,document_id uuid)
language sql stable security definer set search_path='' as $$
 select 'civi:'||e.id,'civi','civi:'||e.source_kind,e.source_kind,e.occurred_at,e.source_date_text,
 e.author_label,e.body,case when e.job_id is not null then e.job_id::text when e.source_job_id<>'' then 'civi:'||e.source_job_id
 when e.job_label<>'' then 'label:'||md5(e.job_label||e.client_label) else '' end,
 coalesce(nullif(e.job_label,''),j.title,''),e.client_label,e.document_id
 from public.candidate_source_events e left join public.jobs j on j.id=e.job_id where e.candidate_id=candidate
 union all
 select 'note:'||n.id,'native','note','',n.created_at,'',coalesce(nullif(a.full_name,''),''),n.body,'','','',null::uuid
 from public.candidate_internal_notes n left join public.account_settings a on a.user_id=n.author_id where n.candidate_id=candidate
 union all
 select 'whatsapp:'||m.id,'native','whatsapp_'||m.status,'',m.created_at,'',coalesce(a.full_name,''),m.body,'','','',null::uuid
 from public.candidate_whatsapp_messages m left join public.account_settings a on a.user_id=m.author_id
 where m.candidate_id=candidate and (m.status<>'draft' or m.author_id=auth.uid())
 union all
 select 'placement:'||p.id,'native','referral','',p.created_at,'',coalesce(a.full_name,''),p.notes,p.job_id::text,j.title,coalesce(cl.name,''),null::uuid
 from public.candidate_placements p join public.jobs j on j.id=p.job_id left join public.agency_clients cl on cl.id=j.client_id
 left join public.account_settings a on a.user_id=p.created_by where p.candidate_id=candidate and public.can_manage_placement(p.id)
 union all
 select 'status:'||h.id,'native','status','',h.created_at,'',coalesce(a.full_name,''),h.status,p.job_id::text,j.title,coalesce(cl.name,''),null::uuid
 from public.placement_activity h join public.candidate_placements p on p.id=h.placement_id join public.jobs j on j.id=p.job_id
 left join public.agency_clients cl on cl.id=j.client_id left join public.account_settings a on a.user_id=h.actor_id
 where p.candidate_id=candidate and public.can_manage_placement(p.id)
 union all
 select 'document:'||d.id,'native','document','',d.created_at,'',coalesce(a.full_name,''),d.label,'','','',d.id
 from public.candidate_documents d left join public.account_settings a on a.user_id=d.uploaded_by where d.candidate_id=candidate
 union all
 select 'interview:'||i.id,'native','interview','',i.created_at,'', '',i.notes||E'\n'||i.starts_at::text,p.job_id::text,j.title,coalesce(cl.name,''),null::uuid
 from public.placement_interviews i join public.candidate_placements p on p.id=i.placement_id join public.jobs j on j.id=p.job_id
 left join public.agency_clients cl on cl.id=j.client_id where p.candidate_id=candidate and public.can_manage_placement(p.id)
 union all
 select 'feedback:'||f.id,'native','feedback','',f.created_at,'',coalesce(a.full_name,''),f.action||case when f.note<>'' then E'\n'||f.note else '' end,
 p.job_id::text,j.title,coalesce(cl.name,''),null::uuid
 from public.client_feedback f join public.client_presentations pr on pr.id=f.presentation_id join public.candidate_placements p on p.id=pr.placement_id
 join public.jobs j on j.id=p.job_id left join public.agency_clients cl on cl.id=j.client_id left join public.account_settings a on a.user_id=f.actor_id
 where p.candidate_id=candidate and public.can_manage_placement(p.id)
$$;
revoke all on function public.candidate_activity_rows(uuid) from public,anon,authenticated;

create function public.candidate_activity(candidate uuid,job_filter text default '',event_filter text default '',search_query text default '',page integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.candidates;result jsonb;
begin
 select * into c from public.candidates where id=candidate;
 if not found or not public.is_member(c.organization_id) or not public.can_read_candidate(c.id) then raise exception 'NOT_PERMITTED';end if;
 if page is null or page<0 or page>100000 or length(coalesce(search_query,''))>300 then raise exception 'INVALID_FILTER';end if;
 with all_rows as materialized(select * from public.candidate_activity_rows(candidate)),
 filtered as(select * from all_rows where (coalesce(job_filter,'')='' or job_key=job_filter)
  and (coalesce(event_filter,'')='' or kind=event_filter)
  and (coalesce(trim(search_query),'')='' or position(lower(trim(search_query)) in lower(title||' '||body||' '||author_label||' '||job_label||' '||client_label))>0)),
 selected as(select * from filtered order by occurred_at desc,id desc limit 25 offset page*25)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(s) order by s.occurred_at desc,s.id desc) from selected s),'[]'::jsonb),
 'count',(select count(*) from filtered),'page_size',25,
 'jobs',coalesce((select jsonb_agg(to_jsonb(j) order by j.label) from (select job_key as key,max(job_label) as label from all_rows where job_key<>'' group by job_key)j),'[]'::jsonb),
 'types',coalesce((select jsonb_agg(to_jsonb(t) order by t.key) from (select distinct kind as key,title as label from all_rows)t),'[]'::jsonb),
 'can_note',public.org_capability(c.organization_id,'candidates.write')) into result;
 return result;
end$$;
revoke all on function public.candidate_activity(uuid,text,text,text,integer) from public,anon;
grant execute on function public.candidate_activity(uuid,text,text,text,integer) to authenticated;
commit;
