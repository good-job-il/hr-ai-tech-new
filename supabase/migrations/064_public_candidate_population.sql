begin;

-- The metric deduplicates contact identities, never merges tenant records.
create function public.public_candidate_population_count() returns bigint
language sql stable security definer set search_path='' as $$
 with test_emails as materialized (
  select lower(trim(u.email)) email from auth.users u
  where coalesce(u.raw_app_meta_data->>'is_test','false')='true'
 ), pool as materialized (
  select case when c.phone_key ~ '^5[0-9]{8}$' then '972'||c.phone_key else c.phone_key end phone,
         nullif(c.email_key,'') email
  from public.candidates c join public.organizations o on o.id=c.organization_id
  where not o.is_test and c.merged_into is null
   and split_part(c.email_key,'@',2) !~ '(^|\.)(invalid|test|example\.(com|net|org))$'
   and not exists(select 1 from test_emails t where t.email=c.email_key)
 ), accounts as materialized (
  select lower(trim(u.email)) email,
   case when public.valid_account_phone(s.contact_phone) then public.normalize_candidate_phone(s.contact_phone)
        when public.valid_account_phone(p.phone) then public.normalize_candidate_phone(p.phone)
        when public.valid_account_phone(u.raw_user_meta_data->>'contact_phone') then public.normalize_candidate_phone(u.raw_user_meta_data->>'contact_phone') end phone
  from auth.users u
  left join public.account_settings s on s.user_id=u.id
  left join public.candidate_profiles p on p.user_id=u.id
  where u.raw_user_meta_data->>'account_type'='candidate'
   and u.email_confirmed_at is not null and u.deleted_at is null
   and coalesce(u.raw_app_meta_data->>'is_test','false')<>'true'
   and split_part(lower(trim(u.email)),'@',2) !~ '(^|\.)(invalid|test|example\.(com|net|org))$'
 ), people as materialized (
  select phone,email from pool
  union all
  select case when phone ~ '^5[0-9]{8}$' then '972'||phone else phone end,email from accounts
 ), email_phone as (
  -- Link an email-only registration/card to its single known phone identity.
  -- Conflicting phones on a shared email are not silently merged.
  select email,min(phone) phone from people where email is not null and phone is not null
  group by email having count(distinct phone)=1
 )
 select count(distinct case when coalesce(p.phone,e.phone) is not null then 'p:'||coalesce(p.phone,e.phone)
                           when p.email is not null then 'e:'||p.email end)
 from people p left join email_phone e on e.email=p.email
$$;
revoke all on function public.public_candidate_population_count() from public;
grant execute on function public.public_candidate_population_count() to anon,authenticated;

commit;
