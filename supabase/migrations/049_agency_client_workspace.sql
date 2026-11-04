begin;
create function public.prevent_client_organization_move() returns trigger language plpgsql set search_path='' as $$begin if new.organization_id is distinct from old.organization_id then raise exception 'CLIENT_ORGANIZATION_IMMUTABLE';end if;return new;end$$;
create trigger client_organization_immutable before update of organization_id on public.agency_clients for each row execute function public.prevent_client_organization_move();
revoke all on function public.prevent_client_organization_move() from public,anon,authenticated;

create index if not exists jobs_client_idx on public.jobs(client_id);
create index if not exists client_presentations_client_idx on public.client_presentations(client_id);
create function public.agency_client_directory(org uuid,search text default '',state text default 'all',page integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;begin
 if not public.org_capability(org,'jobs.manage') then raise exception 'Not permitted';end if;
 if state not in('all','active','inactive') or page<0 or page>100000 or length(search)>160 then raise exception 'INVALID_FILTER';end if;
 with clients as materialized(select c.id,c.name,c.contact_name,c.contact_email,c.active,
 (select count(*) from public.jobs j where j.client_id=c.id and j.organization_id=org and j.status='open') as open_jobs,
 (select count(*) from public.client_presentations s where s.client_id=c.id and public.can_manage_placement(s.placement_id)) as shared_candidates,
 case when public.org_capability(org,'organization.manage') then (select count(*) from public.client_portal_members m where m.client_id=c.id and m.active) else null end as portal_accounts
 from public.agency_clients c where c.organization_id=org),
 filtered as(select * from clients where (state='all' or active=(state='active')) and (trim(search)='' or concat_ws(' ',name,contact_name,contact_email) ilike '%'||trim(search)||'%'))
 select jsonb_build_object('summary',jsonb_build_object('clients',(select count(*) from clients),'open_jobs',(select coalesce(sum(open_jobs),0) from clients),'shared_candidates',(select coalesce(sum(shared_candidates),0) from clients)),'count',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(to_jsonb(r)) from(select * from filtered order by name,id limit 25 offset page*25)r),'[]'::jsonb)) into result;
 return result;end$$;
create function public.agency_client_workspace(client uuid,section text default 'overview',page integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$declare c public.agency_clients;result jsonb;begin
 select * into strict c from public.agency_clients where id=client;
 if not public.org_capability(c.organization_id,'jobs.manage') then raise exception 'Not permitted';end if;
 if section not in('overview','jobs','candidates','interviews','portal','terms') or page<0 or page>100000 then raise exception 'INVALID_FILTER';end if;
 return jsonb_build_object('client',jsonb_build_object('id',c.id,'name',c.name,'contact_name',c.contact_name,'contact_email',c.contact_email,'active',c.active,'notes',case when public.org_capability(c.organization_id,'organization.manage') then c.notes else '' end),
 'counts',jsonb_build_object('jobs',(select count(*) from public.jobs j where j.client_id=c.id),'open_jobs',(select count(*) from public.jobs j where j.client_id=c.id and j.status='open'),'candidates',(select count(*) from public.client_presentations s where s.client_id=c.id and public.can_manage_placement(s.placement_id)),'interviews',(select count(*) from public.placement_interviews i join public.candidate_placements p on p.id=i.placement_id join public.jobs j on j.id=p.job_id where j.client_id=c.id and public.can_manage_placement(p.id)),'portal_accounts',case when public.org_capability(c.organization_id,'organization.manage') then (select count(*) from public.client_portal_members m where m.client_id=c.id and m.active) else null end),
 'jobs',case when section in('overview','jobs') then coalesce((select jsonb_agg(to_jsonb(r)) from(select j.id,j.title,j.location,j.status,j.is_public from public.jobs j where j.client_id=c.id and (section='jobs' or j.status='open') order by j.created_at desc,j.id limit (case when section='overview' then 5 else 25 end) offset (case when section='overview' then 0 else page*25 end))r),'[]'::jsonb) else '[]'::jsonb end,
 'candidates',case when section='candidates' then coalesce((select jsonb_agg(to_jsonb(r)) from(select s.id,s.placement_id,j.id as job_id,s.snapshot->>'full_name' as full_name,j.title as job_title,p.status,s.shared_at,s.revoked_at,(select f.note from public.client_feedback f where f.presentation_id=s.id order by f.created_at desc,f.id desc limit 1) as latest_feedback from public.client_presentations s join public.candidate_placements p on p.id=s.placement_id join public.jobs j on j.id=p.job_id where s.client_id=c.id and public.can_manage_placement(p.id) order by s.shared_at desc,s.id limit 25 offset page*25)r),'[]'::jsonb) else '[]'::jsonb end,
 'interviews',case when section='interviews' then coalesce((select jsonb_agg(to_jsonb(r)) from(select i.id,i.starts_at,i.cancelled_at,p.job_id,cand.full_name,j.title as job_title from public.placement_interviews i join public.candidate_placements p on p.id=i.placement_id join public.candidates cand on cand.id=p.candidate_id join public.jobs j on j.id=p.job_id where j.client_id=c.id and public.can_manage_placement(p.id) order by i.starts_at desc,i.id limit 25 offset page*25)r),'[]'::jsonb) else '[]'::jsonb end);
end$$;
revoke all on function public.agency_client_directory(uuid,text,text,integer),public.agency_client_workspace(uuid,text,integer) from public,anon;
grant execute on function public.agency_client_directory(uuid,text,text,integer),public.agency_client_workspace(uuid,text,integer) to authenticated;
commit;
