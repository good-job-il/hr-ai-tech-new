begin;
create function public.valid_account_phone(value text) returns boolean language plpgsql immutable set search_path='' as $$begin
 if value is null or length(trim(value)) not between 7 and 40 then return false;end if;
 return public.normalize_candidate_phone(value) is not null;
 exception when others then return false;
end$$;
create table public.account_settings(user_id uuid primary key references auth.users on delete cascade,full_name text not null default '' check(length(full_name)<=160),professional_title text not null default '' check(length(professional_title)<=160),contact_phone text not null default '' check(contact_phone='' or public.valid_account_phone(contact_phone)),language text not null default 'he' check(language in('he','en')),compact_tables boolean not null default false,avatar_path text,updated_at timestamptz not null default now(),check(avatar_path is null or avatar_path like user_id::text||'/%'));
alter table public.account_settings enable row level security;
create policy account_settings_own on public.account_settings for select to authenticated using(user_id=auth.uid());
revoke all on public.account_settings from public,anon,authenticated;grant select on public.account_settings to authenticated;
insert into public.account_settings(user_id,full_name,professional_title,contact_phone)
 select u.id,left(coalesce(nullif(u.raw_user_meta_data->>'full_name',''),nullif(p.full_name,''),''),160),left(coalesce(u.raw_user_meta_data->>'professional_title',''),160),case when public.valid_account_phone(u.raw_user_meta_data->>'contact_phone') then trim(u.raw_user_meta_data->>'contact_phone') when public.valid_account_phone(p.phone) then trim(p.phone) else '' end from auth.users u left join public.candidate_profiles p on p.user_id=u.id;

create function public.initialize_account_settings() returns trigger language plpgsql security definer set search_path='' as $$declare phone text:=trim(coalesce(new.raw_user_meta_data->>'contact_phone',''));begin
 if coalesce(new.raw_user_meta_data->>'account_type','candidate') in('agency','employer') and not public.valid_account_phone(phone) then raise exception 'PRIMARY_CONTACT_PHONE_REQUIRED';end if;
 if phone<>'' and not public.valid_account_phone(phone) then raise exception 'INVALID_CONTACT_PHONE';end if;
 insert into public.account_settings(user_id,full_name,professional_title,contact_phone) values(new.id,left(coalesce(new.raw_user_meta_data->>'full_name',''),160),left(coalesce(new.raw_user_meta_data->>'professional_title',''),160),phone);
 return new;
end$$;
create trigger initialize_account_settings after insert on auth.users for each row execute function public.initialize_account_settings();
create function public.my_account_data() returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select to_jsonb(a)||jsonb_build_object('email',u.email,'phone_verified',false,'primary_contact_required',exists(select 1 from public.memberships m where m.user_id=auth.uid() and m.status='active' and public.normalized_role(m.organization_id,m.role)='org_admin')) into result from public.account_settings a join auth.users u on u.id=a.user_id where a.user_id=auth.uid();return result;
end$$;
create function public.save_my_account(display_name text,title text,phone text,preferred_language text,dense_tables boolean,photo_path text default null) returns void language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if display_name is null or length(trim(display_name)) not between 1 and 160 or title is null or length(title)>160 or preferred_language is null or preferred_language not in('he','en') or dense_tables is null or phone is null or (phone<>'' and not public.valid_account_phone(phone)) then raise exception 'INVALID_ACCOUNT_DETAILS';end if;
 if exists(select 1 from public.memberships m where m.user_id=auth.uid() and m.status='active' and public.normalized_role(m.organization_id,m.role)='org_admin') and not public.valid_account_phone(phone) then raise exception 'PRIMARY_CONTACT_PHONE_REQUIRED';end if;
 if photo_path is not null and (split_part(photo_path,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='account-avatars' and name=photo_path)) then raise exception 'INVALID_AVATAR';end if;
 insert into public.account_settings(user_id,full_name,professional_title,contact_phone,language,compact_tables,avatar_path) values(auth.uid(),trim(display_name),trim(title),trim(phone),preferred_language,dense_tables,photo_path) on conflict(user_id) do update set full_name=excluded.full_name,professional_title=excluded.professional_title,contact_phone=excluded.contact_phone,language=excluded.language,compact_tables=excluded.compact_tables,avatar_path=excluded.avatar_path,updated_at=now();
 update auth.users set raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb)||jsonb_build_object('full_name',trim(display_name),'professional_title',trim(title)) where id=auth.uid();
 update public.candidate_profiles set full_name=trim(display_name),phone=trim(save_my_account.phone) where user_id=auth.uid();
end$$;
create function public.save_my_contact_phone(phone text) returns void language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if not public.valid_account_phone(phone) then raise exception 'CONTACT_PHONE_REQUIRED';end if;
 insert into public.account_settings(user_id,contact_phone) values(auth.uid(),trim(phone)) on conflict(user_id) do update set contact_phone=excluded.contact_phone,updated_at=now();
 update public.candidate_profiles set phone=trim(save_my_contact_phone.phone) where user_id=auth.uid();
end$$;
alter function public.create_organization(text,text) rename to create_organization_before_contact;
revoke all on function public.create_organization_before_contact(text,text) from public,anon,authenticated;
create function public.create_organization(org_name text,org_kind text default 'employer') returns uuid language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from public.account_settings a where a.user_id=auth.uid() and public.valid_account_phone(a.contact_phone)) then raise exception 'PRIMARY_CONTACT_PHONE_REQUIRED';end if;
 return public.create_organization_before_contact(org_name,org_kind);
end$$;
create function public.create_organization_with_contact(org_name text,org_kind text,phone text) returns uuid language plpgsql security definer set search_path='' as $$begin
 perform public.save_my_contact_phone(phone);
 return public.create_organization(org_name,org_kind);
end$$;
create function public.require_application_contact() returns trigger language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from public.account_settings a where a.user_id=new.candidate_id and public.valid_account_phone(a.contact_phone)) and not exists(select 1 from public.candidate_profiles p where p.user_id=new.candidate_id and public.valid_account_phone(p.phone)) then raise exception 'APPLICATION_CONTACT_PHONE_REQUIRED';end if;
 return new;
end$$;
create trigger require_application_contact before insert on public.applications for each row execute function public.require_application_contact();
create function public.sync_candidate_account_contact() returns trigger language plpgsql security definer set search_path='' as $$begin
 if tg_op='INSERT' and new.phone='' then update public.account_settings set full_name=new.full_name where user_id=new.user_id and full_name='';return new;end if;
 if new.phone='' and exists(select 1 from public.memberships m where m.user_id=new.user_id and m.status='active' and public.normalized_role(m.organization_id,m.role)='org_admin') then raise exception 'PRIMARY_CONTACT_PHONE_REQUIRED';end if;
 update public.account_settings set full_name=new.full_name,contact_phone=trim(new.phone),updated_at=now() where user_id=new.user_id;
 return new;
end$$;
create trigger sync_candidate_account_contact after insert or update of full_name,phone on public.candidate_profiles for each row execute function public.sync_candidate_account_contact();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('account-avatars','account-avatars',false,3145728,array['image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
create policy account_avatar_read on storage.objects for select to authenticated using(bucket_id='account-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy account_avatar_insert on storage.objects for insert to authenticated with check(bucket_id='account-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy account_avatar_delete on storage.objects for delete to authenticated using(bucket_id='account-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
revoke all on function public.valid_account_phone(text),public.initialize_account_settings(),public.my_account_data(),public.save_my_account(text,text,text,text,boolean,text),public.save_my_contact_phone(text),public.create_organization(text,text),public.create_organization_with_contact(text,text,text),public.require_application_contact(),public.sync_candidate_account_contact() from public,anon;
grant execute on function public.valid_account_phone(text),public.my_account_data(),public.save_my_account(text,text,text,text,boolean,text),public.save_my_contact_phone(text),public.create_organization(text,text),public.create_organization_with_contact(text,text,text) to authenticated;
commit;
