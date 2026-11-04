begin;
create policy platform_external_read on public.external_jobs for select to authenticated using(public.is_platform_admin());
create function public.set_external_publication(vacancy uuid,publish boolean) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.is_platform_admin() then raise exception 'Not permitted';end if;
 update public.external_jobs set publication_status=case when publish then 'published' else 'draft' end where id=vacancy and (not publish or (status='active' and length(description)>0 and verified_at>now()-interval '7 days'));
 if not found then raise exception 'Job unavailable or requires verification';end if;end$$;
revoke all on function public.set_external_publication(uuid,boolean) from public,anon;grant execute on function public.set_external_publication(uuid,boolean) to authenticated;
create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users,application_id uuid references public.applications,kind text not null,read_at timestamptz,created_at timestamptz not null default now());
alter table public.notifications enable row level security;
create policy notification_read on public.notifications for select to authenticated using(user_id=auth.uid());
create policy notification_update on public.notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
revoke all on public.notifications from anon,authenticated;grant select on public.notifications to authenticated;grant update(read_at) on public.notifications to authenticated;
create function public.notify_application_event() returns trigger language plpgsql security definer set search_path='' as $$declare recipient uuid;app public.applications;begin
 if TG_TABLE_NAME='applications' then
  app=new;
  if TG_OP='INSERT' then
   if new.external_job_id is not null then for recipient in select user_id from public.platform_admins loop insert into public.notifications(user_id,application_id,kind) values(recipient,new.id,'new_application');end loop;
   else for recipient in select m.user_id from public.memberships m join public.jobs j on j.organization_id=m.organization_id where j.id=new.job_id and m.role in ('owner','admin','recruiter') loop insert into public.notifications(user_id,application_id,kind) values(recipient,new.id,'new_application');end loop;end if;
  elsif old.status<>new.status then insert into public.notifications(user_id,application_id,kind) values(new.candidate_id,new.id,'status_changed');end if;
 else
  select * into app from public.applications where id=new.application_id;
  insert into public.notifications(user_id,application_id,kind) values(app.candidate_id,app.id,'interview_scheduled');
 end if;return new;end$$;
create trigger notify_application_event after insert or update on public.applications for each row execute function public.notify_application_event();
create trigger notify_interview_event after insert on public.interviews for each row execute function public.notify_application_event();
create table public.profile_views(id uuid primary key default gen_random_uuid(),candidate_id uuid not null references auth.users,viewer_id uuid not null references auth.users,viewed_on date not null default current_date,unique(candidate_id,viewer_id,viewed_on));
alter table public.profile_views enable row level security;
create policy profile_views_read on public.profile_views for select to authenticated using(candidate_id=auth.uid());
revoke all on public.profile_views from anon,authenticated;grant select on public.profile_views to authenticated;
create function public.record_profile_view(application uuid) returns void language plpgsql security definer set search_path='' as $$declare candidate uuid;begin
 if not public.can_manage_application(application) then raise exception 'Not permitted';end if;
 select candidate_id into strict candidate from public.applications where id=application;
 if candidate<>auth.uid() then insert into public.profile_views(candidate_id,viewer_id) values(candidate,auth.uid()) on conflict(candidate_id,viewer_id,viewed_on) do nothing;end if;end$$;
revoke all on function public.record_profile_view(uuid) from public,anon;grant execute on function public.record_profile_view(uuid) to authenticated;
commit;
