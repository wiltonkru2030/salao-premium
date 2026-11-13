# SaaS multitenant — contrato de isolamento

## Modelo
Cada salão é uma organização independente. O mesmo usuário pode, futuramente, participar de mais de uma organização; portanto, a identidade do usuário não substitui o vínculo de membership.

- `auth.users`: identidade e sessão.
- `org_memberships`: vínculo do usuário com a organização e seu papel.
- `org_id`: fronteira obrigatória dos dados do salão.
- `branch_id`: unidade/filial dentro da organização.
- `professional_id`: escopo adicional do App Profissional, nunca substitui o tenant.

## Regras obrigatórias em cada camada

### Interface
- Usar a organização ativa carregada pela autenticação.
- Limitar consultas com `org_id`; filtrar `branch_id` quando a tela operar uma unidade.
- Não aceitar `org_id`, papel, profissional ou permissões de campos editáveis como prova de autorização.
- Limpar estado e dados em memória ao trocar de organização ou encerrar sessão.
- Não misturar listas/cache de tenants diferentes.

### Banco
- RLS habilitada em todas as tabelas expostas com dados de tenant.
- Políticas SELECT/INSERT/UPDATE/DELETE devem validar membership, papel e, quando aplicável, profissional e filial.
- UPDATE deve ter `USING` e `WITH CHECK` para impedir mover registro para outro tenant.
- Chaves estrangeiras compostas ou triggers devem impedir vínculos cruzados entre organizações.
- RPCs devem validar `auth.uid()`, membership e papel dentro do banco; `org_id` recebido é apenas uma solicitação, não uma autorização.
- Funções privilegiadas devem usar `search_path` seguro, validar tenant e ter grants mínimos.
- Nunca confiar em `raw_user_meta_data/user_metadata` para autorização.
- Nunca expor chave `service_role` no navegador.

## Auditoria executada
Foi consultado o estado de RLS das tabelas centrais:
`organizations`, `customers`, `professionals`, `services`, `products`, `appointments`, `appointment_blocks`, `appointment_groups`, `service_orders`, `service_order_items`, `service_order_payments`, `cash_registers`, `cash_movements`, `commissions`, `quotes` e `quote_items`. Todas retornaram RLS habilitada.

As políticas consultadas usam funções de membership/role e escopo profissional, com permissões diferentes por operação. Isso é uma verificação estrutural, não um teste completo de isolamento com dois usuários reais.

## Pontos de segurança ainda abertos
- O advisor do Supabase sinaliza 11 funções `SECURITY DEFINER` executáveis por usuários autenticados. As funções críticas foram criadas para operações controladas e não devem ser revogadas em lote. Cada função deve ser revisada quanto a validação de tenant/papel e necessidade de exposição.
- A proteção de senha comprometida do Supabase Auth está desativada; habilitar em Authentication → Settings → Password Security.
- O isolamento por filial ainda não está implementado como seletor universal em todos os módulos; o Caixa administrativo atualmente opera o caixa padrão da organização.

## Teste de aceitação multitenant obrigatório
Criar duas organizações de teste A e B, com usuários distintos e registros parecidos. Confirmar que:
1. usuário A não lista, lê, atualiza, exclui ou associa clientes/profissionais/serviços da B;
2. A não cria pagamento, movimento de caixa, comissão, orçamento ou agendamento usando IDs de B;
3. trocar tenant limpa filtros, cache, seleções, drawers e estado anterior;
4. profissional de A não vê Agenda, Comanda, pagamentos ou comissões de B;
5. RPCs rejeitam tenant/filial/IDs de outra organização mesmo se chamadas manualmente fora da interface.

Não marcar o SaaS como pronto para produção antes desse teste.
