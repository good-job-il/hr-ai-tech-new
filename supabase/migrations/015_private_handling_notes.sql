begin;
create table public.application_internal_notes(id uuid primary key default gen_random_uuid(),application_id uuid not null references public.applications,author_id uuid not null references auth.users,body text not null check(length(trim(body)) between 1 and 4000),created_at timestamptz not null default now());
alter table public.application_internal_notes enable row level security;
create policy internal_note_read on public.application_internal_notes for select to authenticated using(public.can_manage_application(application_id));
create policy internal_note_create on public.application_internal_notes for insert to authenticated with check(author_id=auth.uid() and public.can_manage_application(application_id));
revoke all on public.application_internal_notes from anon,authenticated;grant select on public.application_internal_notes to authenticated;grant insert(application_id,author_id,body) on public.application_internal_notes to authenticated;
commit;
