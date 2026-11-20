-- SALÃO PREMIUM — hardening pós-aplicação da identidade global.
-- Mantém as solicitações de vínculo inacessíveis por acesso direto à Data API.
-- Acrescenta índices de FK para trilhas de auditoria e referências de usuário.

begin;

create policy customer_identity_link_requests_deny_direct_access
  on public.customer_identity_link_requests
  for all
  to authenticated
  using (false)
  with check (false);

create index customer_account_customers_linked_by_idx
  on public.customer_account_customers (linked_by)
  where linked_by is not null;

create index customer_identity_link_requests_requested_by_idx
  on public.customer_identity_link_requests (requested_by);

commit;