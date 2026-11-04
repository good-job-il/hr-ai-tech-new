begin;
alter table public.candidates add column current_company text not null default '' check(length(current_company)<=240),add column previous_companies text not null default '' check(length(previous_companies)<=2000);
grant insert(current_company,previous_companies) on public.candidates to authenticated;
alter function public.save_candidate_professional(uuid,jsonb) rename to save_candidate_professional_before_companies;
revoke all on function public.save_candidate_professional_before_companies(uuid,jsonb) from public,anon,authenticated;
create function public.save_candidate_professional(candidate uuid,details jsonb) returns void language plpgsql security definer set search_path='' as $$begin
 perform public.save_candidate_professional_before_companies(candidate,details);
 update public.candidates c set current_company=case when details?'current_company' then coalesce(details->>'current_company','') else c.current_company end,previous_companies=case when details?'previous_companies' then coalesce(details->>'previous_companies','') else c.previous_companies end where c.id=candidate;
end$$;
-- Extend the existing paginated, RLS-invoker query rather than searching a downloaded subset.
do $migration$ declare definition text;needle text;replacement text;begin
 definition:=pg_get_functiondef('public.search_candidate_pool(uuid,jsonb,integer)'::regprocedure);
 needle:=' and (coalesce($2->>''language'','''')='''' or c.languages ilike ''%%''||($2->>''language'')||''%%'')';
 replacement:=needle||$extra$
 and (coalesce($2->>'company','')='' or (case $2->>'company_scope' when 'current' then c.current_company when 'previous' then c.previous_companies else concat_ws(' ',c.current_company,c.previous_companies) end) ilike '%%'||($2->>'company')||'%%')
 and (coalesce($2->>'region','')='' or c.region ilike '%%'||($2->>'region')||'%%')
 and (coalesce($2->>'skill','')='' or c.skills ilike '%%'||($2->>'skill')||'%%')
 and (nullif($2->>'experience_max','') is null or c.experience_years<=($2->>'experience_max')::numeric)
 and (nullif($2->>'salary_ceiling','') is null or c.salary_min<=($2->>'salary_ceiling')::numeric)
 and (nullif($2->>'updated_since','') is null or c.updated_at>=($2->>'updated_since')::date)
$extra$;
 if strpos(definition,needle)=0 then raise exception 'SEARCH_EXTENSION_TARGET_MISSING';end if;
 execute replace(definition,needle,replacement);
end $migration$;
revoke all on function public.save_candidate_professional(uuid,jsonb) from public,anon;
grant execute on function public.save_candidate_professional(uuid,jsonb) to authenticated;
commit;
