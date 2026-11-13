drop policy if exists quote_items_staff_write_pending on public.quote_items;
create policy quote_items_staff_write_pending on public.quote_items for all to authenticated
using (
  private.has_org_role(quote_items.org_id,array['owner','admin','manager','receptionist'])
  and exists(select 1 from public.quotes q where q.id=quote_items.quote_id and q.org_id=quote_items.org_id and q.status in ('draft','pending'))
)
with check (
  private.has_org_role(quote_items.org_id,array['owner','admin','manager','receptionist'])
  and exists(select 1 from public.quotes q where q.id=quote_items.quote_id and q.org_id=quote_items.org_id and q.status in ('draft','pending'))
);

create or replace function public.create_quote_appointment_group(p_quote_id uuid,p_items jsonb)
returns jsonb language plpgsql set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_quote public.quotes%rowtype;
  v_customer public.customers%rowtype;
  v_group public.appointment_groups%rowtype;
  v_item record;
  v_quote_item public.quote_items%rowtype;
  v_professional public.professionals%rowtype;
  v_appointment public.appointments%rowtype;
  v_ids uuid[] := array[]::uuid[];
  v_count integer;
  v_distinct integer;
begin
  if v_user is null then raise exception 'Autenticação necessária.'; end if;
  select * into v_quote from public.quotes q where q.id=p_quote_id for update;
  if not found or v_quote.status<>'accepted' then raise exception 'Somente orçamentos aceitos podem ser agendados.'; end if;
  if not private.has_org_role(v_quote.org_id,array['owner','admin','manager','receptionist']) then raise exception 'Sem permissão para agendar este orçamento.'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Informe os horários de todos os serviços.'; end if;
  select count(*) into v_count from public.quote_items qi where qi.org_id=v_quote.org_id and qi.quote_id=v_quote.id;
  select count(distinct x.quote_item_id) into v_distinct from jsonb_to_recordset(p_items) as x(quote_item_id uuid,professional_id uuid,starts_at timestamptz,ends_at timestamptz);
  if v_count<>jsonb_array_length(p_items) or v_distinct<>v_count then raise exception 'Cada serviço do orçamento deve receber exatamente um horário.'; end if;
  select * into v_customer from public.customers c where c.org_id=v_quote.org_id and c.id=v_quote.customer_id;
  if not found then raise exception 'Cliente do orçamento não encontrado.'; end if;
  insert into public.appointment_groups(org_id,branch_id,customer_id,quote_id,created_by)
  values(v_quote.org_id,v_quote.branch_id,v_quote.customer_id,v_quote.id,v_user) returning * into v_group;
  for v_item in select * from jsonb_to_recordset(p_items) as x(quote_item_id uuid,professional_id uuid,starts_at timestamptz,ends_at timestamptz) loop
    select * into v_quote_item from public.quote_items qi where qi.org_id=v_quote.org_id and qi.quote_id=v_quote.id and qi.id=v_item.quote_item_id;
    if not found then raise exception 'Serviço do orçamento inválido.'; end if;
    if v_item.professional_id is null or v_item.starts_at is null or v_item.ends_at is null or v_item.ends_at<=v_item.starts_at
       or round(extract(epoch from (v_item.ends_at-v_item.starts_at))/60)<>v_quote_item.duration_minutes then
      raise exception 'Informe profissional e horário com a duração correta para cada serviço.';
    end if;
    select * into v_professional from public.professionals p where p.org_id=v_quote.org_id and p.id=v_item.professional_id and p.active;
    if not found then raise exception 'Profissional inválido ou inativo.'; end if;
    if exists(select 1 from public.appointments a where a.org_id=v_quote.org_id and a.professional_id=v_item.professional_id and a.status not in ('cancelled','completed','no_show') and a.starts_at<v_item.ends_at and a.ends_at>v_item.starts_at) then raise exception 'Conflito de horário para %.',v_professional.name; end if;
    if exists(select 1 from public.appointment_blocks b where b.org_id=v_quote.org_id and (b.professional_id is null or b.professional_id=v_item.professional_id) and b.starts_at<v_item.ends_at and b.ends_at>v_item.starts_at) then raise exception 'O horário de % está bloqueado.',v_professional.name; end if;
    insert into public.appointments(org_id,branch_id,customer_id,professional_id,service_id,customer_name,customer_phone,service_name,professional_name,starts_at,ends_at,status,price,booking_source,created_by,appointment_group_id)
    values(v_quote.org_id,v_quote.branch_id,v_quote.customer_id,v_professional.id,v_quote_item.service_id,v_customer.name,v_customer.phone,v_quote_item.description,v_professional.name,v_item.starts_at,v_item.ends_at,'scheduled',v_quote_item.total,'salon',v_user,v_group.id)
    returning * into v_appointment;
    insert into public.appointment_group_items(org_id,appointment_group_id,quote_item_id,appointment_id,service_id,professional_id,starts_at,ends_at,price)
    values(v_quote.org_id,v_group.id,v_quote_item.id,v_appointment.id,v_quote_item.service_id,v_professional.id,v_item.starts_at,v_item.ends_at,v_quote_item.total);
    v_ids:=array_append(v_ids,v_appointment.id);
  end loop;
  return jsonb_build_object('group_id',v_group.id,'appointment_ids',to_jsonb(v_ids),'count',cardinality(v_ids));
end; $$;
revoke all on function public.create_quote_appointment_group(uuid,jsonb) from public,anon;
grant execute on function public.create_quote_appointment_group(uuid,jsonb) to authenticated;
