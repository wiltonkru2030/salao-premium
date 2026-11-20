# Endurecimento das RPCs privilegiadas

Data: 20/11/2026

## Objetivo

Reduzir a superfície de exposição das operações financeiras, de estoque, recuperação e início de atendimento sem alterar os nomes, argumentos, valores padrão ou tipos de retorno das RPCs chamadas pelo painel.

## Alteração

As implementações transacionais foram movidas de `public` para `private` e mantidas como `SECURITY DEFINER`, com `search_path` vazio e verificações de autorização internas. Foram criados wrappers SQL no schema público com `SECURITY INVOKER`, preservando o contrato PostgREST.

Funções abrangidas:
- `adjust_product_stock`
- `cancel_expense`
- `cancel_service_order`
- `close_cash_register`
- `open_cash_register`
- `pay_expense`
- `pay_professional_commissions`
- `permanently_delete_recycle_bin_group`
- `refund_service_order`
- `register_cash_movement`
- `register_service_order_payment`
- `restore_recycle_bin_group`
- `revoke_professional_app_access(p_org_id, p_professional_id)`
- `set_professional_app_access(p_org_id, p_target_user_id, p_enabled, p_scope)`
- `start_appointment_group_service_order`
- `start_appointment_service_order`

As sobrecargas legadas de um argumento para revogação e três argumentos para configuração de acesso não foram alteradas: não estavam concedidas a `authenticated` e não faziam parte dos avisos de execução autenticada.

## Permissões

- `anon` não executa os wrappers.
- `authenticated` e `service_role` executam os wrappers autorizados.
- As implementações privadas mantêm verificações de organização/papel e bloqueios transacionais existentes.
- Os wrappers não elevam privilégios; apenas delegam à implementação privada.

## Verificações no banco

- As 15 funções privilegiadas apontadas pelo Security Advisor deixaram de aparecer como SECURITY DEFINER executáveis no schema público.
- O Security Advisor não apresenta mais o aviso `authenticated_security_definer_function_executable`.
- Consulta de catálogo confirmou wrappers públicos como `SECURITY INVOKER`, execução negada a `anon` e permitida a `authenticated` nas 15 RPCs abrangidas.
- A função privada de implementação continua `SECURITY DEFINER`.
- O aviso restante do Security Advisor é a proteção contra senhas vazadas desativada no Supabase Auth. Essa configuração precisa ser habilitada nas configurações de autenticação do projeto.

## Pendências de validação

A verificação de catálogo e permissões não substitui testes funcionais autenticados. Permanecem pendentes testes E2E com contas QA para:
- abrir/fechar caixa;
- lançar movimentos e pagar despesas;
- receber pagamentos parciais e totais;
- pagar comissões;
- estornar/cancelar comandas;
- ajustar estoque;
- restaurar/excluir definitivamente grupos da lixeira;
- iniciar atendimentos individuais e agrupados;
- liberar/revogar acesso profissional;
- negar chamadas entre organizações e papéis sem permissão.

Não considerar o módulo financeiro aprovado para produção até concluir essa matriz de testes.
