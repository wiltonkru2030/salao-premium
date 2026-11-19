# Auditoria de segurança — 19/11/2026

## Escopo desta rodada

Verificação somente leitura no projeto Supabase `vlifbvzlyzoncefvfgol`. Nenhuma tabela, registro, política ou permissão foi alterada nesta rodada.

## Resultados confirmados

- Security Advisor reportou 16 ocorrências de `authenticated_security_definer_function_executable`.
- As 16 funções listadas pelo Advisor não concedem execução ao papel `anon`; todas as funções públicas examinadas usam `search_path = ''`.
- As funções `adjust_product_stock`, `cancel_expense`, `permanently_delete_recycle_bin_group`, `refund_service_order`, `register_cash_movement` e `pay_professional_commissions` foram lidas diretamente no catálogo.
- Nessas seis funções há validação de autenticação e/ou papel da organização antes da operação; os escopos de organização são aplicados às consultas e alterações. A função de estoque usa `private.is_org_admin` (owner/admin/manager); despesas e pagamentos de comissão validam papéis específicos; exclusão permanente da lixeira exige owner/admin; devolução de comanda exige owner/admin/manager/finance.
- `private.has_org_role` e `private.is_org_admin` vinculam o usuário autenticado à associação ativa na organização informada.
- Consulta ao catálogo encontrou zero tabelas no schema `public` com RLS desativado.
- O alerta de proteção contra senhas vazadas permanece ativo no Advisor: recurso desabilitado.

## Interpretação

A ocorrência do linter não prova, isoladamente, uma vulnerabilidade: essas RPCs são usadas pelo aplicativo autenticado e fazem verificações de autorização dentro do corpo. Revogar EXECUTE indiscriminadamente pode interromper Caixa, Comandas, estoque e lixeira. Não foi feita revogação global.

## Pendências

1. Concluir a revisão individual das demais funções listadas pelo Advisor, incluindo fluxos de abertura/fechamento de caixa, pagamentos, cancelamento e App Profissional.
2. Habilitar e validar a proteção de senhas vazadas no Supabase Auth (requer configuração do projeto).
3. Executar testes negativos autenticados com usuários de organizações diferentes para provar isolamento entre tenants; a consulta de catálogo não substitui esses testes.
4. Reavaliar o Advisor após as correções e os testes.

## Fonte

Consulta direta ao catálogo PostgreSQL e Supabase Security Advisor, observados em 19/11/2026.
