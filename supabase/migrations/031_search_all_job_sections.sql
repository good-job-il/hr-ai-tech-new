begin;
create or replace function public.search_public_job_ids(search text) returns table(id uuid,external boolean) language sql stable security invoker set search_path='' as $$
select c.id,c.external from public.public_job_catalog c
left join public.jobs j on not c.external and j.id=c.id
left join public.external_jobs e on c.external and e.id=c.id
where length(trim(search)) between 1 and 160 and concat_ws(' ',c.title,c.company,c.location,c.category,j.description,j.responsibilities,j.requirements,j.benefits,e.description,e.responsibilities,e.requirements,e.benefits,e.localized_content#>>'{he,title}',e.localized_content#>>'{he,description}',e.localized_content#>>'{he,requirements}',e.localized_content#>>'{he,responsibilities}',e.localized_content#>>'{en,title}',e.localized_content#>>'{en,description}',e.localized_content#>>'{en,requirements}',e.localized_content#>>'{en,responsibilities}') ilike '%'||search||'%';
$$;
-- Transparent professional skill coverage; no AI, identity attributes or outcome decisions.
create or replace function public.my_job_skill_matches()
returns table(id uuid,external boolean,percentage integer,matched text[],missing text[],required_count integer)
language sql stable security invoker set search_path=public as $$
 with lexicon(label,pattern) as (values ('React','(^|[^[:alnum:]_])(react)([^[:alnum:]_]|$)'),
('Node.js','(^|[^[:alnum:]_])(node[.]?js)([^[:alnum:]_]|$)'),
('TypeScript','(^|[^[:alnum:]_])(typescript)([^[:alnum:]_]|$)'),
('JavaScript','(^|[^[:alnum:]_])(javascript)([^[:alnum:]_]|$)'),
('Python','(^|[^[:alnum:]_])(python)([^[:alnum:]_]|$)'),
('Java','(^|[^[:alnum:]_])(java)([^[:alnum:]_]|$)'),
('SQL','(^|[^[:alnum:]_])(sql)([^[:alnum:]_]|$)'),
('PostgreSQL','(^|[^[:alnum:]_])(postgresql|postgres)([^[:alnum:]_]|$)'),
('AWS','(^|[^[:alnum:]_])(aws|amazon web services)([^[:alnum:]_]|$)'),
('Azure','(^|[^[:alnum:]_])(azure)([^[:alnum:]_]|$)'),
('GCP','(^|[^[:alnum:]_])(gcp|google cloud)([^[:alnum:]_]|$)'),
('Docker','(^|[^[:alnum:]_])(docker)([^[:alnum:]_]|$)'),
('Kubernetes','(^|[^[:alnum:]_])(kubernetes|k8s)([^[:alnum:]_]|$)'),
('Terraform','(^|[^[:alnum:]_])(terraform)([^[:alnum:]_]|$)'),
('Figma','(^|[^[:alnum:]_])(figma)([^[:alnum:]_]|$)'),
('Excel','(^|[^[:alnum:]_])(excel|אקסל)([^[:alnum:]_]|$)'),
('SAP','(^|[^[:alnum:]_])(sap)([^[:alnum:]_]|$)'),
('Priority','(^|[^[:alnum:]_])(priority|פריוריטי)([^[:alnum:]_]|$)'),
('IFRS','(^|[^[:alnum:]_])(ifrs)([^[:alnum:]_]|$)'),
('US GAAP','(^|[^[:alnum:]_])(us gaap)([^[:alnum:]_]|$)'),
('CPA','(^|[^[:alnum:]_])(cpa|רואה חשבון|רואת חשבון|רואי חשבון)([^[:alnum:]_]|$)'),
('Payroll','(^|[^[:alnum:]_])(payroll|חשבות שכר|חשב שכר|חשבת שכר)([^[:alnum:]_]|$)'),
('Bookkeeping','(^|[^[:alnum:]_])(bookkeeping|הנהלת חשבונות)([^[:alnum:]_]|$)'),
('Budgeting','(^|[^[:alnum:]_])(budgeting|תקציב)([^[:alnum:]_]|$)'),
('Financial reporting','(^|[^[:alnum:]_])(financial reporting|דיווח כספי|דוחות כספיים)([^[:alnum:]_]|$)'),
('FP&A','(^|[^[:alnum:]_])(fp&a|financial planning)([^[:alnum:]_]|$)'),
('Salesforce','(^|[^[:alnum:]_])(salesforce)([^[:alnum:]_]|$)'),
('HubSpot','(^|[^[:alnum:]_])(hubspot)([^[:alnum:]_]|$)'),
('B2B','(^|[^[:alnum:]_])(b2b)([^[:alnum:]_]|$)'),
('SaaS','(^|[^[:alnum:]_])(saas)([^[:alnum:]_]|$)'),
('Team management','(^|[^[:alnum:]_])(team management|people management|ניהול צוות)([^[:alnum:]_]|$)'),
('Project management','(^|[^[:alnum:]_])(project management|ניהול פרויקטים)([^[:alnum:]_]|$)'),
('Product management','(^|[^[:alnum:]_])(product management|ניהול מוצר)([^[:alnum:]_]|$)')),
 profile as (select skills from candidate_profiles where user_id=auth.uid() and length(trim(coalesce(skills,'')))>0),
 roles as (
 select j.id,false external,coalesce(nullif(trim(j.requirements),''),j.description) content from jobs j where j.status='open'
 union all
 select e.id,true,coalesce(nullif(trim(e.requirements),''),e.description) from external_jobs e
 join public_job_catalog c on c.id=e.id and c.external
 ),
 coverage as (select r.id,r.external,array_agg(l.label order by l.label) filter(where p.skills ~* l.pattern) matched,
 array_agg(l.label order by l.label) filter(where not(p.skills ~* l.pattern)) missing,count(*)::integer required_count
 from roles r cross join profile p join lexicon l on r.content ~* l.pattern
 where exists(select 1 from lexicon own where p.skills ~* own.pattern)
 group by r.id,r.external having count(*)>=2)
 select id,external,round(100.0*coalesce(cardinality(matched),0)/required_count)::integer,
 coalesce(matched,'{}'::text[]),coalesce(missing,'{}'::text[]),required_count from coverage;
$$;
revoke all on function public.my_job_skill_matches() from public,anon;
grant execute on function public.my_job_skill_matches() to authenticated;

drop policy company_profile_public_read on public.company_profiles;
create policy company_profile_public_read on public.company_profiles for select using(published and (organization_id is null or exists(select 1 from public.organizations o where o.id=organization_id and not o.is_test)));
commit;
