begin;
create function public.candidate_source_date(value text) returns date language plpgsql immutable set search_path='' as $$declare v text:=trim(coalesce(value,''));m text[];d date;begin
 if v='' or v='-' then return null;end if;
 if v ~ '^\d{4}-\d{2}-\d{2}$' then return v::date;end if;
 m:=regexp_match(v,'^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})([ T](\d{1,2}):(\d{2})(:(\d{2}))?)?$');
 if m is null then raise exception 'INVALID_SOURCE_DATE';end if;
 if m[5] is not null and (m[5]::int>23 or m[6]::int>59 or coalesce(m[8],'0')::int>59) then raise exception 'INVALID_SOURCE_TIME';end if;
 d:=make_date(m[3]::int,m[2]::int,m[1]::int);return d;
end$$;
create function public.normalize_candidate_import_record(details jsonb) returns jsonb language plpgsql immutable set search_path='' as $$declare p jsonb:=details;k text;v text;begin
 foreach k in array array['source_updated_at','source_last_updated_at','interest_confirmed_at','last_contact_at','search_confirmed_at'] loop
 if p?k then p:=jsonb_set(p,array[k],coalesce(to_jsonb(public.candidate_source_date(p->>k)),'null'::jsonb));end if;end loop;
 foreach k in array array['reported_age','birth_year'] loop
 if p?k and trim(coalesce(p->>k,'')) in('','-') then p:=jsonb_set(p,array[k],'null'::jsonb);end if;end loop;
 return p;
end$$;
alter function public.save_candidate_professional(uuid,jsonb) rename to save_candidate_professional_before_format_fix;
revoke all on function public.save_candidate_professional_before_format_fix(uuid,jsonb) from public,anon,authenticated;
create function public.save_candidate_professional(candidate uuid,details jsonb) returns void language plpgsql security definer set search_path='' as $$begin
 perform public.save_candidate_professional_before_format_fix(candidate,public.normalize_candidate_import_record(details));end$$;
create or replace function public.process_candidate_import(batch uuid,chunk_size integer default 200) returns jsonb language plpgsql security definer set search_path='' as $$declare j public.candidate_import_jobs;r public.candidate_import_rows;cid uuid;p jsonb;roles text;role_name text;added_count integer:=0;duplicate_count integer:=0;invalid_count integer:=0;n integer:=0;begin
 select * into strict j from public.candidate_import_jobs where id=batch for update;
 if j.created_by<>auth.uid() or not public.org_capability(j.organization_id,'candidates.write') or j.state not in('ready','running','completed') then raise exception 'Not permitted';end if;
 if chunk_size is null or chunk_size not between 1 and 200 then raise exception 'INVALID_CHUNK';end if;
 if j.state='completed' then return to_jsonb(j);end if;
 for r in select * from public.candidate_import_rows where job_id=batch and status='queued' order by row_number limit chunk_size for update loop
 n:=n+1;p:=r.payload;cid:=null;
 begin
 p:=public.normalize_candidate_import_record(p);
 insert into public.candidates(organization_id,owner_id,full_name,email,phone,visibility) values(j.organization_id,auth.uid(),trim(coalesce(p->>'full_name','')),lower(trim(coalesce(p->>'email',''))),trim(coalesce(p->>'phone','')),j.pool) returning id into cid;
 perform public.save_candidate_professional(cid,p);
 roles:=coalesce(p->>'roles','');
 for role_name in select trim(value) from unnest(string_to_array(roles,';')) value where trim(value)<>'' loop perform public.set_candidate_interest(cid,role_name,coalesce(p->>'domain',''),true,nullif(p->>'interest_confirmed_at','')::date);end loop;
 update public.candidate_import_rows set status='created',candidate_id=cid where job_id=batch and row_number=r.row_number;added_count:=added_count+1;
 exception when unique_violation then
 update public.candidate_import_rows set status='duplicate',reason='EXISTING_CONTACT_NOT_CHANGED' where job_id=batch and row_number=r.row_number;duplicate_count:=duplicate_count+1;
 when check_violation or invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range or raise_exception then
 update public.candidate_import_rows set status='invalid',reason=case when coalesce(p->>'email','')='' and coalesce(p->>'phone','')='' then 'CONTACT_REQUIRED' else 'INVALID_CONTACT_OR_FIELDS' end where job_id=batch and row_number=r.row_number;invalid_count:=invalid_count+1;
 end;
 end loop;
 update public.candidate_import_jobs set processed=processed+n,added=added+added_count,duplicates=duplicates+duplicate_count,invalid=invalid+invalid_count,state=case when processed+n=total then 'completed' else 'running' end,updated_at=now() where id=batch returning * into j;
 if j.state='completed' then insert into public.management_audit(organization_id,actor_id,entity_type,entity_id,action,details) values(j.organization_id,auth.uid(),'candidate_import_jobs',batch,'import_completed',jsonb_build_object('added',j.added,'duplicates',j.duplicates,'invalid',j.invalid));end if;
 return to_jsonb(j);end$$;
revoke all on function public.candidate_source_date(text),public.normalize_candidate_import_record(jsonb),public.save_candidate_professional(uuid,jsonb) from public,anon;
grant execute on function public.candidate_source_date(text),public.normalize_candidate_import_record(jsonb),public.save_candidate_professional(uuid,jsonb) to authenticated;
commit;
