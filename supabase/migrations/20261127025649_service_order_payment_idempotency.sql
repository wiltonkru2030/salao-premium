-- Contrato opt-in de recebimento idempotente: não altera a RPC legada.
-- A chave deve representar uma intenção de recebimento, e ser reutilizada em tentativas da mesma operação.
create table private.service_order_payment_requests (
 org_id uuid not null, order_id uuid not null, actor_id uuid not null, request_id uuid not null,
 amount numeric(14,2) not null, payment_method text not null, result jsonb not null,
 created_at timestamptz not null default now(),
 primary key(org_id,order_id,actor_id,request_id),
 foreign key(org_id,order_id) references public.service_orders(org_id,id) on delete cascade
);
alter table private.service_order_payment_requests enable row level security;
revoke all on private.service_order_payment_requests from public,anon,authenticated;

create function private.register_service_order_payment_once(p_order_id uuid,p_amount numeric,p_payment_method text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target public.service_orders%rowtype; prior private.service_order_payment_requests%rowtype; response jsonb;
begin
 if actor is null or p_request_id is null then raise exception 'Autenticação e identificador da operação obrigatórios.' using errcode='42501';end if;
 if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<=0 or p_amount<>round(p_amount,2) or p_amount>999999999999.99 then
  raise exception 'Informe um valor positivo com até duas casas decimais.' using errcode='22023';
 end if;
 if p_payment_method is null or p_payment_method not in ('cash','pix','credit_card','debit_card','transfer','voucher','other') then
  raise exception 'Forma de pagamento inválida.' using errcode='22023';
 end if;
 -- A mesma trava da operação financeira serializa tentativas da mesma comanda.
 select * into target from public.service_orders where id=p_order_id for update;
 if not found then raise exception 'Comanda indisponível.' using errcode='42501';end if;
 -- Revalidar autorização até para resposta já registrada: não retornar recibos após revogação.
 if (private.has_org_role(target.org_id,array['manager','receptionist']) and not private.has_staff_branch_scope(target.org_id,target.branch_id))
  or not coalesce(private.has_org_role(target.org_id,array['owner','admin','manager','receptionist']) or private.professional_app_scope(target.org_id)='all',false) then
  raise exception 'Sem permissão para receber pagamento nesta unidade.' using errcode='42501';
 end if;
 select * into prior from private.service_order_payment_requests r where r.org_id=target.org_id and r.order_id=target.id and r.actor_id=actor and r.request_id=p_request_id;
 if found then
  if prior.amount<>p_amount or prior.payment_method<>p_payment_method then
   raise exception 'Identificador já utilizado com outros dados. Confira o pagamento antes de continuar.' using errcode='22023';
  end if;
  -- Retorna somente o resultado histórico; o cliente deve atualizar a comanda.
  return prior.result || jsonb_build_object('replayed',true);
 end if;
 response:=private.register_service_order_payment(p_order_id,p_amount,p_payment_method);
 insert into private.service_order_payment_requests(org_id,order_id,actor_id,request_id,amount,payment_method,result)
 values(target.org_id,target.id,actor,p_request_id,p_amount,p_payment_method,response);
 return response||jsonb_build_object('replayed',false);
end $$;
create function public.register_service_order_payment_once(p_order_id uuid,p_amount numeric,p_payment_method text,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select private.register_service_order_payment_once($1,$2,$3,$4)
$$;
revoke all on function private.register_service_order_payment_once(uuid,numeric,text,uuid),public.register_service_order_payment_once(uuid,numeric,text,uuid) from public,anon,authenticated;
grant execute on function private.register_service_order_payment_once(uuid,numeric,text,uuid),public.register_service_order_payment_once(uuid,numeric,text,uuid) to authenticated;
;
