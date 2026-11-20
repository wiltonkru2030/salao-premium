# Auditoria financeira — recebimentos, comissões e estornos

Data: 20/11/2026.

## Constatações verificadas no catálogo do Supabase

- A implementação privada de `register_service_order_payment` aceitava pagamento até um centavo acima do total e considerava encerrada uma comanda com até um centavo faltante.
- A mesma função bloqueia a comanda e o caixa, registra cada parcela no caixa e chama a rotina de comissão proporcional.
- A migration anterior de centavos estritos no repositório não representa fielmente a definição atual: recriar aquela função pública integralmente pode desfazer o wrapper privado e perder o bloqueio/fallback de caixa.
- O banco consultado ainda não possui `commission_rate_snapshot` nem `commission_enabled_snapshot` em `service_order_items`; portanto, a existência da migration no GitHub não comprova implantação do congelamento das regras.
- As funções atuais de cancelamento e devolução bloqueiam operações quando há comissões já pagas. O rascunho de reversões cobre devolução total, mas ainda exige revisão de cancelamento parcial, concorrência com repasses, saldo líquido não positivo e apresentação do débito no painel e app profissional.
- `commission_payout_items` tem restrição de valores não negativos e unicidade por comissão; o rascunho de reversões exige alteração controlada desse contrato.

## Correção versionada nesta rodada

- `src/modules/comanda/services/comanda-operations.js`: valida valores finitos, positivos e com até duas casas decimais antes de comunicar com a API; não arredonda valores inválidos.
- `src/modules/comanda/comanda-operations.test.js`: casos de fração de centavo, valores não finitos, negativos e recebimento válido sem arredondamento.
- `docs/sql/strict-payment-centavos-private.draft.sql`: candidata SQL derivada da definição privada consultada no banco, preservando parâmetros, permissões existentes, bloqueios, fallback de caixa central, registros de pagamentos, vendas, estoque e cálculo de comissão proporcional. Rejeita moeda não finita, fração de centavo, forma de pagamento nula, excesso de saldo e fechamento sem quitação exata.
- `docs/sql/strict-payment-centavos-private.draft.test.mjs`: contrato estático integrado a `npm run test:sql-payment-centavos` e `test:all`.

## Verificação e liberação

As 15 condições estáticas foram conferidas sobre o SQL recuperado do repositório. Não houve execução do teste de integração PostgreSQL nem confirmação de CI para o HEAD desta rodada. A candidata permanece em `docs/sql`, não foi aplicada ao banco remoto e deve ser reconciliada com as migrations anteriores em ambiente descartável.

Casos de QA obrigatórios: R$ 99,99 / R$ 100,00 / R$ 100,01 em comanda de R$ 100,00; pagamentos simultâneos; caixa fechado; isolamento de organizações; parcelas com alteração de taxa; arredondamento acumulado de comissão em centavos; estorno parcial e total com comissão pendente ou paga; compensação sem duplicidade; rollback em falha de estoque.

Não liberar para produção antes desses testes e da reconciliação de migrations. Nenhum lançamento financeiro fictício foi criado nesta rodada.
