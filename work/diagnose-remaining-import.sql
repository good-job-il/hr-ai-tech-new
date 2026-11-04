begin;
create temporary table import_diagnostic(reason text);
grant insert,select on import_diagnostic to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','b3416077-6673-49f9-a277-c412e07a1b01',true);
do $$declare r record;p jsonb;cid uuid;con text;code text;msg text;role_name text;begin
for r in select ir.payload from public.candidate_import_rows ir join public.candidate_import_jobs j on j.id=ir.job_id where j.organization_id='9ebb58cd-1ebb-41bd-9b6f-07883551cac9' and j.total=51892 and ir.status='invalid' order by ir.row_number loop
p:=r.payload;
begin
p:=public.normalize_candidate_import_record(p);
insert into public.candidates(organization_id,owner_id,full_name,email,phone,visibility) values('9ebb58cd-1ebb-41bd-9b6f-07883551cac9',auth.uid(),trim(coalesce(p->>'full_name','')),lower(trim(coalesce(p->>'email',''))),trim(coalesce(p->>'phone','')),'shared') returning id into cid;
perform public.save_candidate_professional(cid,p);
for role_name in select trim(value) from unnest(string_to_array(coalesce(p->>'roles',''),';')) value where trim(value)<>'' loop perform public.set_candidate_interest(cid,role_name,coalesce(p->>'domain',''),true,nullif(p->>'interest_confirmed_at','')::date);end loop;
raise exception using errcode='ZX001',message='CHECK_OK_ROLLBACK';
exception when others then get stacked diagnostics con=CONSTRAINT_NAME,code=RETURNED_SQLSTATE,msg=MESSAGE_TEXT;insert into import_diagnostic values(code||':'||coalesce(con,'')||case when msg in('INVALID_PHONE','INVALID_SOURCE_DATE','INVALID_SOURCE_TIME') then ':'||msg else '' end);end;
end loop;end$$;
select reason,count(*) as sample_rows from import_diagnostic group by reason order by count(*) desc;
rollback;
