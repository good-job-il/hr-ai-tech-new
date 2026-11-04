begin;
create function public.export_candidates(org uuid) returns table(id uuid,full_name text,email text,phone text,visibility text,created_at timestamptz) language plpgsql security definer set search_path='' as $$begin
 if not public.org_capability(org,'candidates.export') then raise exception 'Not permitted';end if;
 insert into public.management_audit(organization_id,actor_id,entity_type,action) values(org,auth.uid(),'candidates','export');
 return query select c.id,c.full_name,c.email,c.phone,c.visibility,c.created_at from public.candidates c where c.organization_id=org and c.merged_into is null and public.can_read_candidate(c.id) order by c.full_name,c.id;
end$$;
revoke all on function public.export_candidates(uuid) from public,anon;grant execute on function public.export_candidates(uuid) to authenticated;
commit;
