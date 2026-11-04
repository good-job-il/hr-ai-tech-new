begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','b3416077-6673-49f9-a277-c412e07a1b01',true);
do $$declare b uuid;r jsonb;n bigint;begin
b:=public.start_candidate_import('9ebb58cd-1ebb-41bd-9b6f-07883551cac9','ROLLBACK-ONLY-QA.csv',3,'shared',gen_random_uuid(),'{}');
perform public.stage_candidate_import(b,1,'[{"full_name":"Rollback fixture one","email":"hh-rollback-036-a@example.invalid","roles":"QA rollback role","city":"QA"},{"full_name":"Rollback duplicate","email":"hh-rollback-036-a@example.invalid"},{"full_name":"Rollback invalid"}]');
perform public.finish_candidate_import_upload(b);
r:=public.process_candidate_import(b,1);
if (r->>'processed')::int<>1 then raise exception 'CHUNK_FAILED';end if;
r:=public.process_candidate_import(b,200);
if r->>'state'<>'completed' or (r->>'added')::int<>1 or (r->>'duplicates')::int<>1 or (r->>'invalid')::int<>1 then raise exception 'COUNTS_FAILED';end if;
r:=public.process_candidate_import(b,200);
if (r->>'added')::int<>1 then raise exception 'RETRY_FAILED';end if;
end$$;
select 'PASS: chunk, resume, duplicate, invalid row, idempotent retry; all changes rolled back' as result;
rollback;
