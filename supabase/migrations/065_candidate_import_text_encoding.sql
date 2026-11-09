begin;

-- Recover only reversible UTF-8 Hebrew bytes previously interpreted as Latin-1.
-- The original import payload remains untouched.
create function public.recover_imported_hebrew_text(value text) returns text
language plpgsql immutable set search_path='' as $$declare repaired text;hex text;encodable boolean;begin
 if value is null or value !~ '[×÷]' then return value;end if;
 select bool_and(code<=255),string_agg(lpad(to_hex(code),2,'0'),'' order by n) into encodable,hex
 from(select ascii(substr(value,n,1)) code,n from generate_series(1,length(value)) n) bytes;
 if not encodable then return value;end if;
 begin repaired:=pg_catalog.convert_from(pg_catalog.decode(hex,'hex'),'UTF8');
 exception when character_not_in_repertoire or untranslatable_character then return value;end;
 if repaired !~ '[א-ת]' then return value;end if;
 return repaired;
end$$;
revoke all on function public.recover_imported_hebrew_text(text) from public,anon,authenticated;

create table public.candidate_text_encoding_repairs(
 batch_id uuid not null,
 candidate_id uuid not null references public.candidates,
 organization_id uuid not null references public.organizations,
 field text not null check(field in('full_name','city','region','gender','marital_status','mobility','driving_license','headline','skills','education','languages','availability','current_company','previous_companies')),
 previous_value text not null,
 repaired_value text not null,
 previous_updated_at timestamptz,
 repaired_at timestamptz not null default now(),
 primary key(batch_id,candidate_id,field),check(previous_value<>repaired_value)
);
alter table public.candidate_text_encoding_repairs enable row level security;
revoke all on public.candidate_text_encoding_repairs from public,anon,authenticated;

commit;
