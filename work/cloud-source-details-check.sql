begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','b3416077-6673-49f9-a277-c412e07a1b01',true);
do $$declare b uuid;r jsonb;c public.candidates;begin
b:=public.start_candidate_import('9ebb58cd-1ebb-41bd-9b6f-07883551cac9','ROLLBACK-SOURCE-FIELDS.csv',1,'shared',gen_random_uuid(),'{}');
perform public.stage_candidate_import(b,1,'[{"full_name":"Synthetic source fixture","email":"hh-source-fields-037@example.invalid","city":"QA city","region":"QA region","gender":"QA source value","reported_age":"40","birth_year":"1986","marital_status":"QA status","mobility":"QA mobility","driving_license":"B","source_last_updated_at":"2026-10-30","source_updated_at":"2026-10-31"}]');
perform public.finish_candidate_import_upload(b);r:=public.process_candidate_import(b,200);
if (r->>'added')::int<>1 then raise exception 'IMPORT_FAILED';end if;
select * into strict c from public.candidates where email='hh-source-fields-037@example.invalid';
if c.region<>'QA region' or c.city<>'QA city' or c.gender<>'QA source value' or c.reported_age<>40 or c.birth_year<>1986 or c.marital_status<>'QA status' or c.mobility<>'QA mobility' or c.driving_license<>'B' or c.source_last_updated_at<>'2026-10-30'::date or c.source_updated_at<>'2026-10-31'::date then raise exception 'SOURCE_VALUES_CHANGED';end if;
end$$;
select 'PASS: requested source fields preserved separately; synthetic import rolled back' as result;
rollback;
