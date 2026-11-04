begin;
select set_config('request.jwt.claim.sub','309617ef-98aa-412c-a972-b38a77a783c0',true);
set local role authenticated;
select public.adjust_commercial_account('9ebb58cd-1ebb-41bd-9b6f-07883551cac9',1,'days',1,'Isolated rollback verification — do not retain','ed000000-0000-4000-8000-000000000077');
select public.adjust_commercial_account('9ebb58cd-1ebb-41bd-9b6f-07883551cac9',1,'days',1,'Isolated rollback verification — do not retain','ed000000-0000-4000-8000-000000000077');
select (public.commercial_account_data('9ebb58cd-1ebb-41bd-9b6f-07883551cac9')->'account'->>'application_balance')::integer=1 as retry_did_not_duplicate;
rollback;
select not exists(select 1 from public.commercial_events where request_key='ed000000-0000-4000-8000-000000000077') as test_event_rolled_back,
 not exists(select 1 from public.commercial_accounts) as no_live_benefits_created,
 (select count(*)=3 from pg_tables where schemaname='public' and tablename in('commercial_accounts','commercial_events','commercial_trial_notices') and rowsecurity) as commercial_rls_enabled;
