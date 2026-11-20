# Orçamentos, descontos e pacotes

## Implementação na branch
Regras puras em quote.rules.js: cálculo em centavos, percentual original preservado, quantidade inteira (1 a 1.000), máximo de 100 itens, atribuição profissional, desconto limitado. A regra de arredondamento efetivo segue o gatilho atual. O painel exige filial para novos orçamentos, usa o catálogo de descontos da organização inteira e não salva quando detecta lista potencialmente truncada (1000). A edição das regras é global; regras de serviços inativos não são preservadas pelo contrato atual. O PDF busca dados da filial do orçamento; impressão ainda usa janela do navegador, link atual depende da Edge Function existente. O fluxo de agendamento limita profissionais à filial e preserva os responsáveis já definidos; a data digitada ainda segue o fuso do dispositivo. A atualização de status compara o estado anterior.

## Banco — auditoria e candidatas
RPCs atuais são invoker, sem EXECUTE anon; existe UNIQUE(org_id,quote_id) em appointment_groups. Consulta sem dados pessoais apontou zero grupos duplicados e zero propostas aceitas expirada na data da consulta.
docs/sql/quote-branch-discount-scheduling.draft.sql: valida quantidade, desconto, filial, prazo de validade na criação e agendamento futuro, duração exata, profissional definido, escopo de serviços e locks ordenados. Não aplicada; exige testes de concorrência, RLS e integração com os demais rascunhos da Comanda. Os writes diretos de quotes e quote_items ainda exigem revisão de integridade, inclusive congelamento de itens/status após aceite, cancelamento depois de conversão e aceite público. Agendamento legado sem filial exige tratamento explícito.
docs/sql/service-package-catalog.draft.sql: duas tabelas candidatas para definição de pacotes, ordem, serviços e pausas; FK composta e RLS, leitura de equipe e escrita ainda não exposta. Não representa pacote vendido, saldo de sessões ou liberação de profissional durante a pausa. Nenhuma tabela de pacote estava implantada na auditoria. Não aplicado.

## Validação
19/19 verificações estáticas nos arquivos relidos. Testes unitários adicionados à suíte; execução integral Node/CI e teste de integração ainda não confirmados. PR #1 está fechada e mesclada em versão anterior; alterações atuais permanecem na branch de trabalho. Nenhuma nova mesclagem ou alteração de dados reais efetuada.
