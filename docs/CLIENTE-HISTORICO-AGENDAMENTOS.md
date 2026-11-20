# Histórico de agendamentos da cliente — rascunho SQL

Este arquivo é um rascunho de migration e **não foi aplicado** ao Supabase.

## Contrato

- A cliente não envia `customer_id` nem `org_id` para determinar titularidade.
- A função usa exclusivamente `auth.uid()` e o vínculo `customer_account_customers` confirmado.
- Exige membership ativa para cada organização.
- Retorna somente dados de agenda necessários à cliente: salão, unidade, serviço, profissional, data, status e preço.
- Inclui histórico legado somente quando a associação foi confirmada.
- A implementação privilegiada fica no schema `private`; a RPC pública é `SECURITY INVOKER`.
- A aplicação consome páginas para não limitar o histórico a 250 linhas.

## Pré-requisitos verificados

- `public.appointments` contém organização, unidade, cliente, serviço, profissional, data, status e preço.
- `public.customer_account_customers` associa `auth_user_id` a `customer_id` dentro da organização.
- `public.customer_tenant_memberships` controla o status do vínculo.
- As tabelas operacionais têm RLS habilitada.

## SQL proposto

Veja `docs/sql/customer-appointment-history.draft.sql` para a definição revisável da função privada e do wrapper autenticado.
