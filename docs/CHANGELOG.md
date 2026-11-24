# Histórico de alterações do Salão Premium

Registre alterações verificadas e publicadas no repositório.

## 24/11/2026

- Registrada a linha de base técnica da `main`, incluindo execução local e comparação com o histórico do Supabase ativo.
- Adicionados plano de execução, registro de pendências, progresso e critérios de homologação.

- Corrigida a fixture da Agenda que falhava em fusos brasileiros. A suíte completa passou em UTC e em America/Sao_Paulo.

- Reexecutadas as verificações no commit `a5e3dc71` e conferidos o histórico remoto por versão, o conteúdo do snapshot e os controles reportados para a branch principal.

- Conferida por hash a cadeia candidata de 97 migrations e registrado o bloqueio de infraestrutura do replay local.

- Provisionado Supabase de QA e aplicado o histórico de 97 migrations. Adicionada configuração de ambiente compartilhada pelas aplicações e pelos links públicos de Orçamentos.

- Registradas a matriz de leitura em QA, a divergência de escopo de gerente e recepção e as diferenças de configuração e funções observadas no replay.

- Ampliada a matriz SQL de QA para escritas de clientes, leitura de despesas e abertura de Caixa por papel e unidade.

- Verificados o saldo em dinheiro, a diferença de fechamento, o bloqueio de fechamento repetido e as permissões das RPCs de Caixa por unidade em QA.

- Verificados recebimentos em centavos, devolução integral, estoque e bloqueio de pagamentos concorrentes em QA.

- Confirmada em QA a recusa da segunda quitação concorrente após a primeira transação confirmar o pagamento.

- Versionada a migration de preparação de atribuições por unidade e verificados os cenários de isolamento e revogação em QA.
