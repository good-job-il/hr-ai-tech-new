begin;
create function public.normalize_candidate_phone(phone text) returns text language plpgsql immutable set search_path='' as $$declare n text;begin
 if trim(coalesce(phone,''))='' then return null;end if;
 if phone !~ '^[+0-9() .-]+$' then raise exception 'INVALID_PHONE';end if;
 n:=regexp_replace(phone,'[^0-9]','','g');
 if left(n,2)='00' then n:=substring(n from 3);elsif left(n,1)='0' and length(n) between 9 and 10 then n:='972'||substring(n from 2);end if;
 if length(n) not between 7 and 15 or n ~ '^([0-9])\1+$' or n in ('1234567','12345678','123456789','1234567890') then raise exception 'INVALID_PHONE';end if;
 return n;
end$$;
alter table public.candidates add column phone text not null default '' check(length(phone)<=40),add column phone_key text generated always as(public.normalize_candidate_phone(phone)) stored;
create unique index candidate_org_phone_unique on public.candidates(organization_id,phone_key) where phone_key is not null;
grant insert(phone),update(phone) on public.candidates to authenticated;
create function public.update_candidate_contact(candidate uuid,phone text) returns void language plpgsql security definer set search_path='' as $$declare c public.candidates;begin
 select * into strict c from public.candidates where id=candidate for update;
 if not public.can_read_candidate(candidate) or not public.org_capability(c.organization_id,'candidates.write') then raise exception 'Not permitted';end if;
 update public.candidates set phone=update_candidate_contact.phone where id=candidate;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action) values(c.organization_id,auth.uid(),'candidates',candidate,'contact_update');
end$$;
create function public.suspected_candidate_duplicates(org uuid) returns table(source_id uuid,target_id uuid,source_name text,target_name text,source_email text,target_email text,reason text) language sql stable security definer set search_path='' as $$
 select a.id,b.id,a.full_name,b.full_name,a.email,b.email,'NAME_REVIEW_REQUIRED'::text
 from public.candidates a join public.candidates b on a.organization_id=b.organization_id and a.id<b.id
 where a.organization_id=org and public.org_capability(org,'reports.read') and public.can_read_candidate(a.id) and public.can_read_candidate(b.id) and a.merged_into is null and b.merged_into is null
 and length(regexp_replace(lower(a.full_name),'\s','','g'))>=4
 and (regexp_replace(lower(a.full_name),'\s','','g')=regexp_replace(lower(b.full_name),'\s','','g') or (select count(distinct token) from unnest(regexp_split_to_array(lower(trim(a.full_name)),'\s+')) token where length(token)>1 and token=any(regexp_split_to_array(lower(trim(b.full_name)),'\s+')))>=2)
 order by a.id,b.id limit 100;
$$;
create table public.merge_proposals(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,source_id uuid not null references public.candidates,target_id uuid not null references public.candidates,requested_by uuid not null references auth.users,reason text not null check(length(trim(reason)) between 5 and 2000),status text not null default 'pending' check(status in ('pending','reviewed','declined')),reviewed_by uuid references auth.users,created_at timestamptz not null default now(),check(source_id<>target_id));
create unique index pending_merge_proposal_pair on public.merge_proposals(organization_id,least(source_id,target_id),greatest(source_id,target_id)) where status='pending';
alter table public.merge_proposals enable row level security;
create policy proposal_read on public.merge_proposals for select to authenticated using(public.is_member(organization_id) and (public.org_capability(organization_id,'candidates.merge') or (requested_by=auth.uid() and public.can_read_candidate(source_id) and public.can_read_candidate(target_id))));
revoke all on public.merge_proposals from public,anon,authenticated;grant select on public.merge_proposals to authenticated;
create function public.propose_candidate_merge(source uuid,target uuid,reason text) returns void language plpgsql security definer set search_path='' as $$declare org uuid;begin
 select organization_id into strict org from public.candidates where id=source;
 if not public.org_capability(org,'candidates.team') or not public.can_read_candidate(source) or not public.can_read_candidate(target) or not exists(select 1 from public.candidates where id=target and organization_id=org and merged_into is null) then raise exception 'Not permitted';end if;
 insert into public.merge_proposals(organization_id,source_id,target_id,requested_by,reason) values(org,source,target,auth.uid(),reason);
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action) values(org,auth.uid(),'candidates',source,'merge_proposed');
end$$;
create function public.review_merge_proposal(proposal uuid,decision text) returns void language plpgsql security definer set search_path='' as $$declare p public.merge_proposals;begin
 select * into strict p from public.merge_proposals where id=proposal for update;
 if not public.org_capability(p.organization_id,'candidates.merge') or decision not in ('reviewed','declined') or p.status<>'pending' then raise exception 'Not permitted';end if;
 update public.merge_proposals set status=decision,reviewed_by=auth.uid() where id=p.id;
 insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(p.organization_id,auth.uid(),'merge_proposals',p.id,'proposal_review',jsonb_build_object('decision',decision));
end$$;
revoke all on function public.update_candidate_contact(uuid,text),public.suspected_candidate_duplicates(uuid),public.propose_candidate_merge(uuid,uuid,text),public.review_merge_proposal(uuid,text) from public,anon;
grant execute on function public.update_candidate_contact(uuid,text),public.suspected_candidate_duplicates(uuid),public.propose_candidate_merge(uuid,uuid,text),public.review_merge_proposal(uuid,text) to authenticated;
create function public.update_candidate_details(candidate uuid,candidate_name text,candidate_email text,pool text,phone text) returns void language plpgsql security definer set search_path='' as $$begin
 perform public.normalize_candidate_phone(phone);
 perform public.update_candidate(candidate,candidate_name,candidate_email,pool);
 perform public.update_candidate_contact(candidate,phone);
end$$;
revoke all on function public.update_candidate_details(uuid,text,text,text,text) from public,anon;grant execute on function public.update_candidate_details(uuid,text,text,text,text) to authenticated;
commit;
