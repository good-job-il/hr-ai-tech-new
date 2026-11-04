begin;
create table public.candidate_table_preferences(organization_id uuid not null references public.organizations,user_id uuid not null references auth.users,column_order text[] not null check(cardinality(column_order)=7 and column_order @> array['name','phone','email','created_at','updated_at','pool','owner']::text[] and column_order <@ array['name','phone','email','created_at','updated_at','pool','owner']::text[]),primary key(organization_id,user_id));
alter table public.candidate_table_preferences enable row level security;
create policy candidate_table_preferences_own on public.candidate_table_preferences for all to authenticated using(user_id=auth.uid() and public.is_member(organization_id)) with check(user_id=auth.uid() and public.is_member(organization_id));
revoke all on public.candidate_table_preferences from public,anon,authenticated;
grant select,insert,update on public.candidate_table_preferences to authenticated;
commit;
