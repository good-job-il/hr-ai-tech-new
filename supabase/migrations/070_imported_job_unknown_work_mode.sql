-- Imported jobs must not acquire an invented onsite/office condition.
-- Empty string means the source did not specify the work arrangement.
begin;
alter table public.jobs drop constraint jobs_work_mode_check;
alter table public.jobs add constraint jobs_work_mode_check
 check(work_mode in ('','onsite','hybrid','remote'));
commit;
