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

- Adicionada gestão de atribuições por unidade para proprietários e administradores na página Equipe e permissões.

- Aplicado em QA o escopo de unidade nas tabelas operacionais e nas RPCs de Caixa, com verificação de leitura, edição, abertura e fechamento.

- Acrescentada verificação de unidade nas RPCs financeiras encadeadas e nas consultas às entidades vinculadas.

- Aplicado escopo de unidade às RPCs de espera, encaixes e início de atendimento, com cenários positivos e negativos em QA.

- Protegida a gestão de pacotes por unidade, mantendo a leitura do catálogo compartilhado.

- Compartilhado o símbolo oficial nas três entradas e corrigido o retorno da estrutura autenticada da Área da Cliente.

- Centralizados os tokens de tema e verificada a troca automática de aparência da Área da Cliente em Chromium.

- Corrigidas respostas obsoletas no autocomplete e padronizados os estados, o teclado e o toque nos aplicativos que usam o componente.

- Aplicada no App Profissional a paleta compartilhada com controle de aparência automática, clara e escura.

- Disponibilizada aparência administrativa na entrada e em Configurações, com paleta aplicada ao layout compartilhado.

- Ajustadas as cores dos calendários, estados de atendimento e bloqueios da Agenda no tema escuro.

- Padronizados cards, estados e formulários da Comanda e do Caixa para o tema escuro.

- Mapeados para a paleta compartilhada os modais, formulários, gavetas e detalhes de recuperação.

- Ajustado o contraste de indicadores, totais, filtros e avisos de Financeiro e Relatórios e compartilhada a paleta com Comissões.

- Ajustado o contraste do painel de Comissões e adicionados nomes acessíveis à pesquisa e à forma de pagamento.

- Ajustados preços, ações e estados do catálogo para temas claro e escuro e exposta a seleção de categoria para tecnologias assistivas.

- Ajustadas as máscaras na edição de dados salvos e no fim da composição, com preservação do cursor e dos campos somente leitura.
