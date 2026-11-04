begin;
-- Preserve source values; do not infer age, gender or marital status or use them in matching.
alter table public.candidates add column region text not null default '' check(length(region)<=240),add column gender text not null default '' check(length(gender)<=120),add column reported_age integer check(reported_age between 0 and 120),add column birth_year integer check(birth_year between 1900 and 2100),add column marital_status text not null default '' check(length(marital_status)<=120),add column mobility text not null default '' check(length(mobility)<=240),add column driving_license text not null default '' check(length(driving_license)<=240),add column source_last_updated_at date;
grant insert(region,gender,reported_age,birth_year,marital_status,mobility,driving_license,source_last_updated_at) on public.candidates to authenticated;
alter function public.save_candidate_professional(uuid,jsonb) rename to save_candidate_professional_before_source_details;
revoke all on function public.save_candidate_professional_before_source_details(uuid,jsonb) from public,anon,authenticated;
create function public.save_candidate_professional(candidate uuid,details jsonb) returns void language plpgsql security definer set search_path='' as $$begin
 perform public.save_candidate_professional_before_source_details(candidate,details);
 update public.candidates c set
 region=case when details?'region' then coalesce(details->>'region','') else c.region end,
 gender=case when details?'gender' then coalesce(details->>'gender','') else c.gender end,
 reported_age=case when details?'reported_age' then nullif(details->>'reported_age','')::integer else c.reported_age end,
 birth_year=case when details?'birth_year' then nullif(details->>'birth_year','')::integer else c.birth_year end,
 marital_status=case when details?'marital_status' then coalesce(details->>'marital_status','') else c.marital_status end,
 mobility=case when details?'mobility' then coalesce(details->>'mobility','') else c.mobility end,
 driving_license=case when details?'driving_license' then coalesce(details->>'driving_license','') else c.driving_license end,
 source_last_updated_at=case when details?'source_last_updated_at' then nullif(details->>'source_last_updated_at','')::date else c.source_last_updated_at end
 where c.id=candidate;
end$$;
revoke all on function public.save_candidate_professional(uuid,jsonb) from public,anon;
grant execute on function public.save_candidate_professional(uuid,jsonb) to authenticated;
commit;
