-- Preferências individuais e dados de contato do App Profissional.
-- Nenhuma chave Pix é usada como autorização ou instrução automática de pagamento.
create table if not exists private.professional_app_preferences(
 org_id uuid not null, professional_id uuid not null,
 pix_type text, pix_key text, photo_url text,
 notify_agenda boolean not null default true,
 notify_commissions boolean not null default true,
 updated_at timestamptz not null default now(),
 primary key(org_id,professional_id),
 foreign key(org_id,professional_id) references public.professionals(org_id,id) on delete cascade,
 check ((pix_type is null)=(pix_key is null))
);
alter table private.professional_app_preferences enable row level security;
revoke all on private.professional_app_preferences from public,anon,authenticated;

-- A leitura usa o vínculo profissional autenticado, jamais um ID fornecido pelo cliente.
create or replace function private.get_professional_app_preferences(target_org uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare prof uuid:=private.current_professional_id(target_org); p public.professionals%rowtype; pref private.professional_app_preferences%rowtype; unit_name text;
begin
 if auth.uid() is null or prof is null then raise exception 'Perfil não autorizado.' using errcode='42501'; end if;
 select * into p from public.professionals x where x.org_id=target_org and x.id=prof;
 select b.name into unit_name from public.branches b where b.org_id=target_org and b.id=p.branch_id;
 select * into pref from private.professional_app_preferences x where x.org_id=target_org and x.professional_id=prof;
 return jsonb_build_object('name',p.name,'phone',p.phone,'email',p.email,'specialty',p.specialty,'unit_name',unit_name,'pix_type',pref.pix_type,'pix_key',pref.pix_key,'photo_url',pref.photo_url,'notify_agenda',coalesce(pref.notify_agenda,true),'notify_commissions',coalesce(pref.notify_commissions,true));
end $$;

-- Atualiza apenas e-mail de contato e preferências pessoais. Não altera Auth, nome, telefone ou comissão.
create or replace function private.save_professional_app_preferences(target_org uuid,contact_email text,new_pix_type text,new_pix_key text,new_photo_url text,agenda_enabled boolean,commissions_enabled boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prof uuid:=private.current_professional_id(target_org);
 email_value text:=nullif(btrim(coalesce(contact_email,'')),'');
 key_type text:=nullif(btrim(coalesce(new_pix_type,'')),'');
 key_value text:=nullif(btrim(coalesce(new_pix_key,'')),'');
 photo text:=nullif(btrim(coalesce(new_photo_url,'')),'');
begin
 if auth.uid() is null or prof is null then raise exception 'Perfil não autorizado.' using errcode='42501'; end if;
 if email_value is not null and (char_length(email_value)>254 or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') then raise exception 'E-mail inválido.' using errcode='22023'; end if;
 if (key_type is null)<>(key_value is null) then raise exception 'Informe o tipo e a chave Pix.' using errcode='22023'; end if;
 if key_type is not null then
  if key_type in ('cpf','cnpj','phone') then key_value:=regexp_replace(key_value,'[^0-9]','','g'); end if;
  if char_length(key_value)>254 or not coalesce(case key_type
   when 'cpf' then key_value ~ '^[0-9]{11}$'
   when 'cnpj' then key_value ~ '^[0-9]{14}$'
   when 'phone' then key_value ~ '^55[0-9]{10,11}$'
   when 'email' then key_value ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
   when 'random' then key_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   else false end,false) then raise exception 'Formato da chave Pix inválido.' using errcode='22023'; end if;
 end if;
 if photo is not null and (char_length(photo)>2048 or photo !~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?/[^[:space:]]*$') then raise exception 'Informe um endereço HTTPS de imagem.' using errcode='22023'; end if;
 if agenda_enabled is null or commissions_enabled is null then raise exception 'Preferências inválidas.' using errcode='22023'; end if;
 update public.professionals x set email=email_value where x.org_id=target_org and x.id=prof and x.active and x.access_enabled;
 if not found then raise exception 'Perfil não autorizado.' using errcode='42501'; end if;
 insert into private.professional_app_preferences(org_id,professional_id,pix_type,pix_key,photo_url,notify_agenda,notify_commissions)
 values(target_org,prof,key_type,key_value,photo,agenda_enabled,commissions_enabled)
 on conflict(org_id,professional_id) do update set pix_type=excluded.pix_type,pix_key=excluded.pix_key,photo_url=excluded.photo_url,notify_agenda=excluded.notify_agenda,notify_commissions=excluded.notify_commissions,updated_at=now();
 return private.get_professional_app_preferences(target_org);
end $$;

create or replace function public.get_professional_app_preferences(target_org uuid)
returns jsonb language sql stable security invoker set search_path='' as $$ select private.get_professional_app_preferences($1) $$;
create or replace function public.save_professional_app_preferences(target_org uuid,contact_email text,new_pix_type text,new_pix_key text,new_photo_url text,agenda_enabled boolean,commissions_enabled boolean)
returns jsonb language sql security invoker set search_path='' as $$ select private.save_professional_app_preferences($1,$2,$3,$4,$5,$6,$7) $$;
revoke all on function private.get_professional_app_preferences(uuid),public.get_professional_app_preferences(uuid),private.save_professional_app_preferences(uuid,text,text,text,text,boolean,boolean),public.save_professional_app_preferences(uuid,text,text,text,text,boolean,boolean) from public,anon;
grant execute on function private.get_professional_app_preferences(uuid),public.get_professional_app_preferences(uuid),private.save_professional_app_preferences(uuid,text,text,text,text,boolean,boolean),public.save_professional_app_preferences(uuid,text,text,text,text,boolean,boolean) to authenticated;
