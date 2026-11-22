begin;
alter table public.candidates add column experience text not null default '' check(length(experience)<=8000);

-- Fill existing rows only. Never use the broad professional-save RPC with a partial CV payload.
create function public.fill_candidate_from_cv(candidate uuid,details jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.candidates; filled text[] := '{}'; k text; v text;
begin
 select * into strict c from public.candidates where id=candidate and merged_into is null for update;
 if not public.can_read_candidate(candidate) or not public.org_capability(c.organization_id,'candidates.write')
    or (c.owner_id<>auth.uid() and not public.org_capability(c.organization_id,'candidates.all')) then raise exception 'Not permitted';end if;
 if jsonb_typeof(details) is distinct from 'object' or octet_length(details::text)>50000 then raise exception 'Invalid CV fields';end if;
 foreach k in array array['full_name','email','phone','headline','experience','education','skills','languages','city'] loop
  if jsonb_typeof(details->k) is distinct from 'string' then continue;end if;
  v:=trim(details->>k);
  if v='' or length(v)>(case k when 'full_name' then 160 when 'email' then 254 when 'phone' then 40 when 'headline' then 240 when 'experience' then 8000 when 'education' then 4000 when 'skills' then 2000 when 'languages' then 1000 else 240 end) then continue;end if;
  if coalesce(trim(to_jsonb(c)->>k),'')<>'' then continue;end if;
  -- Identical contacts in another row must not be introduced silently.
  if k='phone' and exists(select 1 from public.candidates other where other.organization_id=c.organization_id and other.id<>c.id and other.merged_into is null and public.normalize_candidate_phone(other.phone)=public.normalize_candidate_phone(v)) then raise exception 'CV_CONTACT_CONFLICT';end if;
  execute format('update public.candidates set %I=$1 where id=$2',k) using v,c.id;
  filled:=array_append(filled,k);
 end loop;
 if cardinality(filled)>0 then
  insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details)
  values(c.organization_id,auth.uid(),'candidates',c.id,'cv_fields_filled',jsonb_build_object('fields',filled));
 end if;
 return jsonb_build_object('filled',filled);
end$$;

create function public.fill_my_profile_from_cv(details jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.candidate_profiles; filled text[] := '{}'; k text; v text; uid uuid := auth.uid();
begin
 if uid is null then raise exception 'Not permitted';end if;
 if jsonb_typeof(details) is distinct from 'object' or octet_length(details::text)>50000 then raise exception 'Invalid CV fields';end if;
 -- The PK serializes repeated imports for the same person. No organization candidate is created.
 if not exists(select 1 from public.candidate_profiles where user_id=uid) then
  if jsonb_typeof(details->'full_name') is distinct from 'string' or nullif(trim(details->>'full_name'),'') is null or length(trim(details->>'full_name'))>160 then raise exception 'CV_NAME_REQUIRED';end if;
  insert into public.candidate_profiles(user_id,full_name) values(uid,trim(details->>'full_name')) on conflict(user_id) do nothing;
  if found then filled:=array_append(filled,'full_name');end if;
 end if;
 select * into strict c from public.candidate_profiles where user_id=uid for update;
 foreach k in array array['full_name','phone','headline','experience','education','skills'] loop
  if jsonb_typeof(details->k) is distinct from 'string' then continue;end if;
  v:=trim(details->>k);
  if v='' or length(v)>(case k when 'full_name' then 160 when 'phone' then 40 when 'headline' then 240 when 'experience' then 8000 when 'education' then 4000 else 2000 end) then continue;end if;
  if coalesce(trim(to_jsonb(c)->>k),'')<>'' then continue;end if;
  execute format('update public.candidate_profiles set %I=$1 where user_id=$2',k) using v,uid;
  filled:=array_append(filled,k);
 end loop;
 return jsonb_build_object('filled',filled);
end$$;
alter function public.save_candidate_professional(uuid,jsonb) rename to save_candidate_professional_before_cv;
revoke all on function public.save_candidate_professional_before_cv(uuid,jsonb) from public,anon,authenticated;
create function public.save_candidate_professional(candidate uuid,details jsonb) returns void language plpgsql security definer set search_path='' as $$begin
 perform public.save_candidate_professional_before_cv(candidate,details);
 if details?'experience' then update public.candidates set experience=coalesce(details->>'experience','') where id=candidate;end if;
end$$;
revoke all on function public.save_candidate_professional(uuid,jsonb) from public,anon;
grant execute on function public.save_candidate_professional(uuid,jsonb) to authenticated;

revoke all on function public.fill_candidate_from_cv(uuid,jsonb),public.fill_my_profile_from_cv(jsonb) from public,anon;
grant execute on function public.fill_candidate_from_cv(uuid,jsonb),public.fill_my_profile_from_cv(jsonb) to authenticated;
commit;
