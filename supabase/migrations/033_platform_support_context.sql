begin;
create table public.platform_support_sessions(
 id uuid primary key default gen_random_uuid(), actor_id uuid not null references auth.users,
 organization_id uuid not null references public.organizations,
 mode text not null default 'read' check(mode in('read','edit')),
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '15 minutes',closed_at timestamptz
);
alter table public.platform_support_sessions enable row level security;
revoke all on public.platform_support_sessions from public,anon,authenticated;
create function public.start_platform_support(org uuid) returns uuid language plpgsql security definer set search_path='' as $$declare sid uuid;begin
 if not public.is_platform_admin() then raise exception 'Not permitted';end if;
 if not exists(select 1 from public.organizations where id=org) then raise exception 'Organization unavailable';end if;
 update public.platform_support_sessions set closed_at=now() where actor_id=auth.uid() and closed_at is null;
 insert into public.platform_support_sessions(actor_id,organization_id) values(auth.uid(),org) returning id into sid;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action) values(org,auth.uid(),'platform_support_sessions',sid,'support_started_read_only');return sid;
end$$;
create function public.platform_support_context(sid uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare s public.platform_support_sessions;result jsonb;begin
 select * into s from public.platform_support_sessions where id=sid and actor_id=auth.uid() and closed_at is null and expires_at>now();
 if not found or not public.is_platform_admin() then raise exception 'Support session expired or not permitted';end if;
 select jsonb_build_object('session_id',s.id,'mode',s.mode,'expires_at',s.expires_at,'organization',(select jsonb_build_object('id',id,'name',name,'kind',kind) from public.organizations where id=s.organization_id),
 'counts',jsonb_build_object('candidates',(select count(*) from public.candidates where organization_id=s.organization_id and merged_into is null),'jobs',(select count(*) from public.jobs where organization_id=s.organization_id),'placements',(select count(*) from public.candidate_placements where organization_id=s.organization_id),'members',(select count(*) from public.memberships where organization_id=s.organization_id and status='active')),
 'candidates',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (select id,full_name,email,phone,visibility from public.candidates where organization_id=s.organization_id and merged_into is null order by full_name limit 100)x),
 'jobs',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (select id,title,location,status,type,description from public.jobs where organization_id=s.organization_id order by created_at desc limit 100)x),
 'placements',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (select p.id,p.status,c.full_name,j.title from public.candidate_placements p join public.candidates c on c.id=p.candidate_id and c.organization_id=s.organization_id join public.jobs j on j.id=p.job_id and j.organization_id=s.organization_id where p.organization_id=s.organization_id order by p.created_at desc limit 100)x),
 'members',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (select m.user_id,m.role,m.status,coalesce(nullif(p.full_name,''),u.email) display_name from public.memberships m join auth.users u on u.id=m.user_id left join public.candidate_profiles p on p.user_id=m.user_id where m.organization_id=s.organization_id order by m.role limit 100)x)) into result;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action) values(s.organization_id,auth.uid(),'platform_support_sessions',sid,'support_context_viewed');return result;
end$$;
create function public.set_platform_support_mode(sid uuid,editable boolean) returns void language plpgsql security definer set search_path='' as $$declare s public.platform_support_sessions;begin
 select * into s from public.platform_support_sessions where id=sid and actor_id=auth.uid() and closed_at is null and expires_at>now() for update;
 if not found or not public.is_platform_admin() then raise exception 'Not permitted';end if;
 update public.platform_support_sessions set mode=case when editable then 'edit' else 'read' end where id=sid;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action) values(s.organization_id,auth.uid(),'platform_support_sessions',sid,case when editable then 'support_edit_enabled' else 'support_read_only_enabled' end);
end$$;
create function public.update_platform_support_job(sid uuid,job uuid,new_title text,new_location text,new_description text,new_status text) returns void language plpgsql security definer set search_path='' as $$declare s public.platform_support_sessions;before_row jsonb;begin
 select * into s from public.platform_support_sessions where id=sid and actor_id=auth.uid() and mode='edit' and closed_at is null and expires_at>now() for update;
 if not found or not public.is_platform_admin() then raise exception 'Editing not permitted';end if;
 select jsonb_build_object('title',title,'location',location,'description',description,'status',status) into before_row from public.jobs where id=job and organization_id=s.organization_id for update;
 if not found then raise exception 'Job unavailable in this organization';end if;
 update public.jobs set title=trim(new_title),location=trim(new_location),description=trim(new_description),status=new_status where id=job and organization_id=s.organization_id;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(s.organization_id,auth.uid(),'jobs',job,'platform_support_job_updated',jsonb_build_object('support_session',sid,'before',before_row,'after',jsonb_build_object('title',new_title,'location',new_location,'description',new_description,'status',new_status)));
end$$;
create function public.end_platform_support(sid uuid) returns void language plpgsql security definer set search_path='' as $$declare org uuid;begin
 update public.platform_support_sessions set closed_at=now() where id=sid and actor_id=auth.uid() and closed_at is null returning organization_id into org;
 if found then insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action) values(org,auth.uid(),'platform_support_sessions',sid,'support_closed');end if;
end$$;
revoke all on function public.start_platform_support(uuid),public.platform_support_context(uuid),public.set_platform_support_mode(uuid,boolean),public.update_platform_support_job(uuid,uuid,text,text,text,text),public.end_platform_support(uuid) from public,anon;
grant execute on function public.start_platform_support(uuid),public.platform_support_context(uuid),public.set_platform_support_mode(uuid,boolean),public.update_platform_support_job(uuid,uuid,text,text,text,text),public.end_platform_support(uuid) to authenticated;
commit;
