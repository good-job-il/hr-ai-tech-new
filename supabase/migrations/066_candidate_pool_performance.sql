begin;

-- Same active-membership/owner/shared/capability/team/explicit-access predicates.
-- Resolve the current user's active organizations once per statement instead
-- of calling is_member(organization_id) separately for every candidate.
drop policy candidate_read on public.candidates;
create policy candidate_read on public.candidates for select to authenticated using(
 merged_into is null
 and organization_id in (
  select m.organization_id from public.memberships m
  where m.user_id=(select auth.uid()) and m.status='active'
 )
 and (
  owner_id=(select auth.uid()) or visibility='shared'
  or public.org_capability(organization_id,'candidates.all')
  or (public.org_capability(organization_id,'candidates.team') and public.manages_member(organization_id,owner_id))
  or exists(select 1 from public.candidate_access a where a.candidate_id=candidates.id and a.user_id=(select auth.uid()))
 )
);

-- Materialize only IDs and sort keys; fetch full cards for the selected25.
create or replace function public.search_candidate_pool(org uuid,filters jsonb default '{}',page integer default 0) returns jsonb language plpgsql stable security invoker set search_path='' as $$declare rows jsonb;total bigint;sort_expression text;direction text;begin
 if not public.is_member(org) or page is null or page<0 then raise exception 'Not permitted';end if;
 sort_expression:=case coalesce(filters->>'sort_by','name') when 'name' then 'lower(full_name)' when 'phone' then 'nullif(phone,'''')' when 'email' then 'lower(nullif(email,''''))' when 'created_at' then 'created_at' when 'updated_at' then 'updated_at' when 'pool' then 'visibility' when 'owner' then 'case when c.owner_id=auth.uid() then case when $2->>''ui_lang''=''en'' then ''Me'' else ''אני'' end else coalesce(o.display_name,case when $2->>''ui_lang''=''en'' then ''Team member'' else ''חבר צוות'' end) end' else null end;
 direction:=case coalesce(filters->>'sort_direction','asc') when 'asc' then 'asc' when 'desc' then 'desc' else null end;
 if sort_expression is null or direction is null then raise exception 'INVALID_SORT';end if;
 execute format($query$
with owners as materialized(select * from public.team_directory($1)),matches as materialized(select c.id,%s as _sort from public.candidates c %s where c.organization_id=$1 and c.merged_into is null
 and (coalesce($2->>'query','')='' or concat_ws(' ',c.full_name,c.email,c.phone,c.headline,c.skills) ilike '%%'||($2->>'query')||'%%')
 and (coalesce($2->>'city','')='' or c.city ilike '%%'||($2->>'city')||'%%')
 and (coalesce($2->>'language','')='' or c.languages ilike '%%'||($2->>'language')||'%%')
 and (coalesce($2->>'company','')='' or (case $2->>'company_scope' when 'current' then c.current_company when 'previous' then c.previous_companies else concat_ws(' ',c.current_company,c.previous_companies) end) ilike '%%'||($2->>'company')||'%%')
 and (coalesce($2->>'region','')='' or c.region ilike '%%'||($2->>'region')||'%%')
 and (coalesce($2->>'skill','')='' or c.skills ilike '%%'||($2->>'skill')||'%%')
 and (nullif($2->>'experience_max','') is null or c.experience_years<=($2->>'experience_max')::numeric)
 and (nullif($2->>'salary_ceiling','') is null or c.salary_min<=($2->>'salary_ceiling')::numeric)
 and (nullif($2->>'updated_since','') is null or c.updated_at>=($2->>'updated_since')::date)

 and (coalesce($2->>'status','')='' or c.search_status=$2->>'status')
 and (coalesce($2->>'pool','all')='all' or ($2->>'pool'='mine' and c.owner_id=auth.uid()) or c.visibility=$2->>'pool')
 and (coalesce($2->>'role','')='' or exists(select 1 from public.candidate_interests i join public.career_roles r on r.id=i.role_id where i.candidate_id=c.id and i.active and r.name ilike '%%'||($2->>'role')||'%%'))
 and (coalesce($2->>'domain','')='' or exists(select 1 from public.candidate_interests i join public.career_roles r on r.id=i.role_id where i.candidate_id=c.id and i.active and r.domain ilike '%%'||($2->>'domain')||'%%'))
 and (nullif($2->>'experience_min','') is null or c.experience_years>=($2->>'experience_min')::numeric)
 and (coalesce($2->>'incomplete','false')<>'true' or c.city='' or c.headline='' or c.search_status='unknown'))
 select (select count(*) from matches),coalesce((select jsonb_agg(to_jsonb(c) order by p._sort %s nulls last,c.id asc) from(select * from matches order by _sort %s nulls last,id asc limit 25 offset $3*25)p join public.candidates c on c.id=p.id),'[]');
$query$,sort_expression,case when filters->>'sort_by'='owner' then 'left join owners o on o.user_id=c.owner_id' else '' end,direction,direction) into total,rows using org,filters,page;
 return jsonb_build_object('count',total,'rows',rows);
end$$;

commit;
