begin;

-- Owner decision 2026-11-16: clients only see referrals awaiting their response.
-- No business rejection reasons are invented or seeded by this migration.
create table public.organization_rejection_reasons(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations,
 label text not null check(length(trim(label)) between 1 and 160),
 label_en text check(label_en is null or length(trim(label_en)) between 1 and 160),
 active boolean not null default true,
 sort_order integer not null default 0,
 unique(organization_id,label)
);
alter table public.organization_rejection_reasons enable row level security;
revoke all on public.organization_rejection_reasons from public,anon,authenticated;

alter table public.client_presentations add column share_revision integer not null default 1 check(share_revision>0);
alter table public.client_feedback add column share_revision integer not null default 1;
alter table public.client_feedback add column rejection_reason_id uuid references public.organization_rejection_reasons;
alter table public.client_feedback add column rejection_reason_label text;

-- Feedback predating the latest explicit share belongs to a previous request.
-- Preserve it for the agency without hiding an unanswered, re-shared referral.
update public.client_feedback f set share_revision=case
 when f.created_at>=s.shared_at and f.privacy_version=s.privacy_version then 1 else 0 end
from public.client_presentations s where s.id=f.presentation_id;

create function public.client_feedback_share_revision() returns trigger language plpgsql security definer set search_path='' as $$begin
 select share_revision into strict new.share_revision from public.client_presentations where id=new.presentation_id;
 return new;
end$$;
create trigger client_feedback_share_revision before insert on public.client_feedback for each row execute function public.client_feedback_share_revision();
revoke all on function public.client_feedback_share_revision() from public,anon,authenticated;

alter function public.share_candidate_portal(uuid,text,uuid,boolean) rename to share_candidate_portal_before_inbox;
revoke all on function public.share_candidate_portal_before_inbox(uuid,text,uuid,boolean) from public,anon,authenticated;
create function public.share_candidate_portal(submission uuid,professional_summary text default '',document uuid default null,anonymous_reviewed boolean default false) returns uuid language plpgsql security definer set search_path='' as $$declare pid uuid;begin
 pid:=public.share_candidate_portal_before_inbox(submission,professional_summary,document,anonymous_reviewed);
 -- A deliberate new agency share is a new request, without erasing old feedback.
 update public.client_presentations set share_revision=share_revision+1 where id=pid;
 return pid;
end$$;
revoke all on function public.share_candidate_portal(uuid,text,uuid,boolean) from public,anon;
grant execute on function public.share_candidate_portal(uuid,text,uuid,boolean) to authenticated;

create function public.can_view_client_presentation(presentation uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.client_presentations p where p.id=presentation and p.revoked_at is null and public.has_client_portal(p.client_id)
  and not exists(select 1 from public.client_feedback f where f.presentation_id=p.id and f.share_revision=p.share_revision));
$$;
revoke all on function public.can_view_client_presentation(uuid) from public,anon;
grant execute on function public.can_view_client_presentation(uuid) to authenticated;

alter function public.client_portal_data() rename to client_portal_data_before_inbox;
revoke all on function public.client_portal_data_before_inbox() from public,anon,authenticated;
create function public.client_portal_data() returns jsonb language plpgsql stable security definer set search_path='' as $$declare payload jsonb;begin
 payload:=public.client_portal_data_before_inbox();
 return payload||jsonb_build_object('schema_version',2,
  'clients',coalesce((select jsonb_agg(c||jsonb_build_object('rejection_reasons',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'label',r.label,'label_en',r.label_en) order by r.sort_order,r.label,r.id) from public.organization_rejection_reasons r join public.agency_clients ac on ac.organization_id=r.organization_id where ac.id=(c->>'id')::uuid and r.active),'[]'::jsonb))) from jsonb_array_elements(payload->'clients') c),'[]'::jsonb),
  'presentations',coalesce((select jsonb_agg(p||jsonb_build_object('share_revision',(select s.share_revision from public.client_presentations s where s.id=(p->>'id')::uuid),'feedback','[]'::jsonb) order by (p->>'shared_at')::timestamptz desc,p->>'id') from jsonb_array_elements(payload->'presentations') p where public.can_view_client_presentation((p->>'id')::uuid)),'[]'::jsonb));
end$$;
revoke all on function public.client_portal_data() from public,anon;
grant execute on function public.client_portal_data() to authenticated;

alter function public.client_presentation_document(uuid) rename to client_presentation_document_before_inbox;
revoke all on function public.client_presentation_document_before_inbox(uuid) from public,anon,authenticated;
create function public.client_presentation_document(presentation uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not public.can_view_client_presentation(presentation) then raise exception 'Not permitted';end if;
 return public.client_presentation_document_before_inbox(presentation);
end$$;
revoke all on function public.client_presentation_document(uuid) from public,anon;
grant execute on function public.client_presentation_document(uuid) to authenticated;

create or replace function public.can_read_org_document(path text) returns boolean language plpgsql stable security definer set search_path='' as $$declare doc public.candidate_documents;c public.candidates;begin
 select * into doc from public.candidate_documents where object_path=path;
 if found then
  return (public.can_read_candidate(doc.candidate_id) and public.org_capability(doc.organization_id,'cv.download'))
   or exists(select 1 from public.client_presentations s where s.snapshot->>'document_id'=doc.id::text and public.can_view_client_presentation(s.id));
 end if;
 select * into c from public.candidates where id::text=split_part(path,'/',2) and organization_id::text=split_part(path,'/',1);
 return found and public.can_read_candidate(c.id) and public.org_capability(c.organization_id,'cv.download');
end$$;

alter function public.submit_client_feedback(uuid,text,text,timestamptz) rename to submit_client_feedback_before_inbox;
revoke all on function public.submit_client_feedback_before_inbox(uuid,text,text,timestamptz) from public,anon,authenticated;
create function public.submit_client_portal_response(presentation uuid,expected_revision integer,response_action text,response_note text default '',rejection_reason uuid default null,interview_at timestamptz default null) returns void language plpgsql security definer set search_path='' as $$
declare s public.client_presentations;org uuid;reason public.organization_rejection_reasons;note text;feedback_id uuid;
begin
 select * into strict s from public.client_presentations where id=presentation for update;
 if not public.can_view_client_presentation(presentation) then raise exception 'Not permitted';end if;
 if expected_revision is distinct from s.share_revision then raise exception 'REFERRAL_UPDATED';end if;
 if response_action not in('proceed','reject','information','interview','interview_scheduled','note','hired','started','ended') or response_action is null then raise exception 'INVALID_RESPONSE';end if;
 if response_note is null or length(response_note)>4000 then raise exception 'INVALID_RESPONSE_NOTE';end if;
 select organization_id into strict org from public.agency_clients where id=s.client_id;
 note:=response_note;
 if response_action='reject' then
  select * into reason from public.organization_rejection_reasons where id=rejection_reason and organization_id=org and active;
  if not found then raise exception 'REJECTION_REASON_REQUIRED';end if;
  -- Keep the reason visible in existing agency feedback screens as well as typed fields.
  if length(response_note)>3999-length(reason.label) then raise exception 'RESPONSE_NOTE_TOO_LONG';end if;
  note:=reason.label||case when trim(response_note)<>'' then E'\n'||response_note else '' end;
 elsif rejection_reason is not null then raise exception 'UNEXPECTED_REJECTION_REASON';end if;
 perform public.submit_client_feedback_before_inbox(presentation,response_action,note,interview_at);
 select f.id into strict feedback_id from public.client_feedback f where f.presentation_id=presentation and f.share_revision=s.share_revision;
 if response_action='reject' then update public.client_feedback set rejection_reason_id=reason.id,rejection_reason_label=reason.label where id=feedback_id;end if;
end$$;
revoke all on function public.submit_client_portal_response(uuid,integer,text,text,uuid,timestamptz) from public,anon;
grant execute on function public.submit_client_portal_response(uuid,integer,text,text,uuid,timestamptz) to authenticated;

-- Guard the legacy RPC too: it cannot bypass answered-referral or reason checks.
create function public.submit_client_feedback(presentation uuid,feedback_action text,feedback_note text default '',interview_at timestamptz default null) returns void language plpgsql security definer set search_path='' as $$declare revision integer;begin
 select share_revision into strict revision from public.client_presentations where id=presentation;
 perform public.submit_client_portal_response(presentation,revision,feedback_action,feedback_note,null,interview_at);
end$$;
revoke all on function public.submit_client_feedback(uuid,text,text,timestamptz) from public,anon;
grant execute on function public.submit_client_feedback(uuid,text,text,timestamptz) to authenticated;

-- Existing signed URLs/CDN copies still require the separate HR-8/HR-12 rollout.
-- Do not treat this migration as proof of legacy-byte revocation.
commit;
