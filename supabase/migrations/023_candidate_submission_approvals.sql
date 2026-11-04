begin;
create table public.candidate_submissions(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,placement_id uuid not null references public.candidate_placements,requested_by uuid not null references auth.users,status text not null check(status in ('pending','approved','rejected','sent')),reviewed_by uuid references auth.users,review_note text not null default '' check(length(review_note)<=2000),sent_by uuid references auth.users,sent_at timestamptz,created_at timestamptz not null default now());
create unique index current_submission on public.candidate_submissions(placement_id) where status in ('pending','approved','sent');
alter table public.candidate_submissions enable row level security;
create policy submission_read on public.candidate_submissions for select to authenticated using(public.can_manage_placement(placement_id));
revoke all on public.candidate_submissions from public,anon,authenticated;grant select on public.candidate_submissions to authenticated;
create function public.request_candidate_submission(placement uuid) returns void language plpgsql security definer set search_path='' as $$declare p public.candidate_placements;required boolean;begin
 select * into strict p from public.candidate_placements where id=placement for update;
 if not public.can_manage_placement(placement) or p.status in ('rejected','withdrawn') then raise exception 'Not permitted';end if;
 select m.approval_required and m.role in ('recruitment_coordinator','internal_coordinator') into strict required from public.memberships m where m.organization_id=p.organization_id and m.user_id=auth.uid() and m.status='active';
 insert into public.candidate_submissions(organization_id,placement_id,requested_by,status) values(p.organization_id,p.id,auth.uid(),case when required then 'pending' else 'approved' end);
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action) values(p.organization_id,auth.uid(),'candidate_placements',p.id,'submission_requested');
end$$;
create function public.decide_candidate_submission(submission uuid,approve boolean,note text default '') returns void language plpgsql security definer set search_path='' as $$declare s public.candidate_submissions;begin
 select * into strict s from public.candidate_submissions where id=submission for update;
 if s.status<>'pending' or not public.org_capability(s.organization_id,'approvals.manage') or not public.can_manage_placement(s.placement_id) or not (public.org_capability(s.organization_id,'candidates.all') or public.manages_member(s.organization_id,s.requested_by)) then raise exception 'Not permitted';end if;
 update public.candidate_submissions set status=case when approve then 'approved' else 'rejected' end,reviewed_by=auth.uid(),review_note=note where id=s.id;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(s.organization_id,auth.uid(),'candidate_submissions',s.id,'submission_decision',jsonb_build_object('approved',approve));
end$$;
create function public.record_candidate_sent(submission uuid) returns void language plpgsql security definer set search_path='' as $$declare s public.candidate_submissions;begin
 select * into strict s from public.candidate_submissions where id=submission for update;
 if s.status<>'approved' or not public.can_manage_placement(s.placement_id) or not (s.requested_by=auth.uid() or public.org_capability(s.organization_id,'candidates.all')) then raise exception 'Not permitted';end if;
 update public.candidate_submissions set status='sent',sent_by=auth.uid(),sent_at=now() where id=s.id;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action) values(s.organization_id,auth.uid(),'candidate_submissions',s.id,'manual_submission_recorded');
end$$;
revoke all on function public.request_candidate_submission(uuid),public.decide_candidate_submission(uuid,boolean,text),public.record_candidate_sent(uuid) from public,anon;
grant execute on function public.request_candidate_submission(uuid),public.decide_candidate_submission(uuid,boolean,text),public.record_candidate_sent(uuid) to authenticated;
commit;
