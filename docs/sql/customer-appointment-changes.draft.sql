-- Candidata QA: alteração de agendamento próprio, sem tocar em comandas ou grupos.
-- Política provisória: somente antes do início, sem taxa; mantém preço e cupom originais.
begin;
create or replace function private.change_my_customer_appointment(p_appointment_id uuid,p_action text,p_expected_start timestamptz,p_new_start timestamptz default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_user uuid := (select auth.uid());
  a public.appointments%rowtype;
begin
  if v_user is null then raise exception 'Entre na sua conta.' using errcode='42501'; end if;
  if p_action is null or p_action not in ('cancel','reschedule') then raise exception 'Operação inválida.' using errcode='22023'; end if;
  select ap.* into a from public.appointments ap
  join public.customer_account_customers l on l.org_id=ap.org_id and l.customer_id=ap.customer_id and l.auth_user_id=v_user
  join public.customer_tenant_memberships m on m.org_id=l.org_id and m.auth_user_id=l.auth_user_id and m.status='active'
  where ap.id=p_appointment_id for update of ap;
  if not found then raise exception 'Agendamento indisponível para esta conta.' using errcode='42501'; end if;
  if a.status='cancelled' and p_action='cancel' then return a.id; end if;
  if a.starts_at is distinct from p_expected_start then raise exception 'O agendamento mudou. Atualize a lista.' using errcode='40001'; end if;
  if a.status not in ('scheduled','confirmed') or a.starts_at<=clock_timestamp() then raise exception 'Entre em contato com o salão para alterar este atendimento.' using errcode='22023'; end if;
  if a.service_order_id is not null or a.appointment_group_id is not null or exists(select 1 from public.service_orders o where o.org_id=a.org_id and o.appointment_id=a.id) then raise exception 'Este atendimento deve ser alterado pelo salão.' using errcode='22023'; end if;
  if p_action='cancel' then
    update public.appointments set status='cancelled' where id=a.id and org_id=a.org_id;
  else
    if p_new_start is null or not isfinite(p_new_start) or p_new_start<=clock_timestamp() or a.branch_id is null or a.professional_id is null then raise exception 'Escolha um horário futuro válido.' using errcode='22023'; end if;
    if not exists(select 1 from public.professionals p where p.id=a.professional_id and p.org_id=a.org_id and p.active) then raise exception 'O profissional não está disponível.' using errcode='22023'; end if;
    -- O gatilho existente valida expediente, bloqueios, reservas e concorrência.
    update public.appointments set starts_at=p_new_start,ends_at=p_new_start+(a.ends_at-a.starts_at),status='scheduled' where id=a.id and org_id=a.org_id;
  end if;
  return a.id;
end;
$$;
revoke all on function private.change_my_customer_appointment(uuid,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function private.change_my_customer_appointment(uuid,text,timestamptz,timestamptz) to authenticated;
create or replace function public.change_my_customer_appointment(p_appointment_id uuid,p_action text,p_expected_start timestamptz,p_new_start timestamptz default null)
returns uuid language sql security invoker set search_path='' as $$
select private.change_my_customer_appointment(p_appointment_id,p_action,p_expected_start,p_new_start);
$$;
revoke all on function public.change_my_customer_appointment(uuid,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.change_my_customer_appointment(uuid,text,timestamptz,timestamptz) to authenticated;
commit;
