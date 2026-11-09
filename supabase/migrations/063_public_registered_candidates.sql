begin;

-- Public aggregate only: never grant visitors access to account rows.
create function public.public_registered_candidate_count() returns bigint
language sql stable security definer set search_path='' as $$
 select count(*) from auth.users u
 where u.raw_user_meta_data->>'account_type'='candidate'
   and u.email_confirmed_at is not null
   and u.deleted_at is null
   and coalesce(u.raw_app_meta_data->>'is_test','false')<>'true'
   and split_part(lower(u.email),'@',2) !~ '(^|\.)(invalid|test|example\.(com|net|org))$'
$$;
revoke all on function public.public_registered_candidate_count() from public;
grant execute on function public.public_registered_candidate_count() to anon,authenticated;

commit;
