begin;

alter table public.notifications add column placement_id uuid references public.candidate_placements on delete set null;

create or replace function public.notify_client_feedback() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.notifications(user_id,kind,placement_id)
  select shared_by,'client_feedback',placement_id
  from public.client_presentations where id=new.presentation_id;
  return new;
end;
$$;

create function public.recruitment_work_queue(org uuid)
returns table(kind text, event_id uuid, job_id uuid, record_id uuid, job_title text, candidate_name text, occurred_at timestamptz)
language sql stable security invoker set search_path='' as $$
  with approvals as (
    select 'approval'::text as kind, s.id as event_id, p.job_id, p.id as record_id,
      j.title as job_title, c.full_name as candidate_name, s.created_at as occurred_at
    from public.candidate_submissions s
    join public.candidate_placements p on p.id=s.placement_id and p.organization_id=org
    join public.jobs j on j.id=p.job_id
    join public.candidates c on c.id=p.candidate_id
    where s.organization_id=org and s.status='pending'
      and public.org_capability(org,'approvals.manage')
      and (public.org_capability(org,'candidates.all') or public.manages_member(org,s.requested_by))
    order by s.created_at,s.id limit 10
  ), feedback as (
    select 'client_feedback'::text as kind, n.id as event_id, p.job_id, p.id as record_id,
      j.title as job_title, c.full_name as candidate_name, n.created_at as occurred_at
    from public.notifications n
    join public.candidate_placements p on p.id=n.placement_id and p.organization_id=org
    join public.jobs j on j.id=p.job_id
    join public.candidates c on c.id=p.candidate_id
    where n.user_id=auth.uid() and n.kind='client_feedback' and n.read_at is null
      and public.can_manage_placement(p.id)
    order by n.created_at desc,n.id limit 10
  )
  select * from approvals union all select * from feedback;
$$;

revoke all on function public.recruitment_work_queue(uuid) from public,anon;
grant execute on function public.recruitment_work_queue(uuid) to authenticated;

commit;
