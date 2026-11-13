# Agenda, Comanda e Caixa — fluxo operacional

## Agenda

A Agenda administrativa consulta os registros persistidos em `appointments` e os bloqueios em `appointment_blocks`. O calendário apresenta Dia/Semana/Mês, profissional, horário, cliente, serviço e estado.

- Profissional precisa estar ativo e habilitado para o serviço.
- Triggers do banco verificam conflito de horário e compatibilidade de serviço.
- A chegada do cliente habilita a abertura da Comanda.
- Atendimento com vários serviços usa `appointment_group_id`; a RPC `start_appointment_group_service_order` abre todos os itens numa única transação.
- O cancelamento e a conclusão mantêm o estado sincronizado com a Comanda.

## Comanda

A Comanda é o registro operacional do atendimento.

- Itens de serviço e produto guardam profissional responsável, quantidade, preço, desconto e total.
- É permitido adicionar itens enquanto a Comanda estiver aberta.
- Edição e exclusão dos itens são bloqueadas após o primeiro pagamento confirmado para preservar o histórico.
- Produtos só baixam estoque quando a Comanda é quitada.
- Não é permitido receber pagamento sem um caixa aberto.
- Cada pagamento parcial ou final cria uma linha em `service_order_payments` e uma entrada correspondente em `cash_movements`.
- O saldo é recalculado no servidor e pagamentos acima do saldo são recusados.

## Comissões

- Percentual padrão do profissional pode ser substituído por regra específica profissional + serviço.
- Cada recebimento gera comissão proporcional; o lançamento guarda percentual e base aplicados.
- Pagamentos parciais não aguardam a quitação total para aparecer no módulo Comissões.
- Pagamento ao profissional cria uma saída no Caixa e vincula os lançamentos pagos.
- Comissão já paga impede cancelamento automático sem ajuste financeiro.

## Caixa

- Abertura e fechamento são feitos por RPCs transacionais.
- O fechamento bloqueia a linha do caixa e calcula o saldo esperado no banco, impedindo concorrência com recebimentos e pagamentos.
- Entradas incluem cada pagamento da Comanda.
- Saídas incluem pagamento de comissão e estornos.
- Movimentos de Comanda e estornos possuem `service_order_id` para consulta e rastreabilidade.
- O Caixa administrativo atual opera o caixa padrão da organização (`branch_id IS NULL`).

## Cancelamento e estorno

- Comanda sem recebimentos: pode ser cancelada e os agendamentos vinculados são cancelados.
- Comanda com recebimentos parciais: exige confirmação de estorno integral; cada pagamento confirmado vira uma saída de estorno no Caixa, e o pagamento original fica com status `refunded`.
- Comissões não pagas daquele recebimento são canceladas.
- Comanda fechada/quitada: não é cancelada por este fluxo. Devolução de venda fechada requer fluxo próprio para estoque e financeiro.

## Migrations associadas

- `20261113010050_integrate_partial_commissions_cash_and_grouped_comandas`
- `20261113010144_require_open_cash_for_payments_and_refunds`
- `20261113010244_serialize_cash_register_movements`
- `20261113010311_fix_grouped_order_existing_uuid_lookup`
- `20261113010319_index_financial_refund_foreign_keys`
- `20261113010559_document_financial_and_agenda_database_contracts`
- `20261113010702_use_default_cash_register_for_branch_transactions`

## Testes pendentes

As migrations e funções foram aplicadas/verificadas no banco, e os workflows de build/regressão verificam sintaxe, imports e testes automatizados. Ainda precisam de teste operacional com dados controlados:
- pagamento em 2 ou mais parcelas;
- alteração de percentual entre parcelas;
- pagamento de comissão e conferência da saída;
- cancelamento com estorno integral;
- corrida entre recebimento e fechamento do Caixa;
- atendimento agrupado com vários profissionais;
- conflitos e bloqueios concorrentes;
- visual desktop e celular.
