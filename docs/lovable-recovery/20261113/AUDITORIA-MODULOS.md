# Auditoria comparativa dos módulos — 2026-11-13

## Escopo e método
Comparação estrutural entre o snapshot recuperado do Lovable (commit `401fc9e8...`, preservado em `docs/lovable-recovery/20261113/commit-401fc9e8-project-changes.patch`) e a árvore oficial do repositório na branch `main`. Foram consultados os arquivos oficiais da Agenda, Comanda, Caixa e Orçamentos, os dois SQLs novos da recuperação e o estado de CI. Nenhuma migration foi executada nesta auditoria; consultas ao Supabase foram somente leitura.

## Conclusão arquitetural
O snapshot recuperado contém uma aplicação paralela em `public/salao/src/`, com implementações próprias de Agenda, Comanda, Caixa, Orçamentos, autenticação e App Profissional. A aplicação oficial já possui esses domínios em `src/` (por exemplo, `src/agenda/`, `src/pages/comanda.js`, `src/pages/cash.js` e `src/modules/quotes/`). Portanto, copiar o snapshot inteiro para a raiz criaria duplicidade de implementação e risco de divergência. Os módulos recuperados devem ser tratados como referência de comparação, não como substitutos automáticos.

## Resultado por módulo

| Módulo | Situação na árvore oficial | Situação no snapshot recuperado | Decisão |
|---|---|---|---|
| Agenda | `src/agenda/` e adaptador `src/pages/agenda.js` já existem | Outra implementação em `public/salao/src/agenda/`, com componentes, controllers, hooks e testes | Não copiar em bloco. Comparar regras específicas e portar somente lacunas comprovadas. |
| Comanda | `src/pages/comanda.js` e `src/modules/comanda/` já existem | Outra implementação em `public/salao/src/modules/comanda/` e `public/salao/src/pages/comanda.js` | Não duplicar. Conferir equivalência funcional e testes no código oficial. |
| Caixa | `src/pages/cash.js` e `src/modules/cash/` já existem | Outra implementação em `public/salao/src/modules/cash/` e `public/salao/src/pages/cash.js` | Não duplicar. Revisar escopo por filial antes de qualquer integração. |
| Orçamentos | `src/modules/quotes/`, `src/pages/quotes.js` e `docs/ORCAMENTOS.md` já existem | O snapshot também inclui `public/salao/src/modules/quotes/` e uma página própria | A documentação oficial confirma criação transacional, desconto validado, aceite e agendamento em grupo. Não copiar a segunda versão. |
| App Profissional | Há funções e políticas próprias no backend oficial | O snapshot traz outro PWA em `public/salao/professional/` | Tratar como app separado; validar permissões/RLS antes de reutilizar qualquer interface. |

## Achado de backend que exige correção controlada

A migration `20261113034347_dbd6acb8-12c0-4a49-9e33-93a41fb61d2e.sql` define `public.pay_expense` selecionando exclusivamente caixa aberto com `branch_id is null`. Entretanto, a despesa possui `branch_id` e o fluxo de pagamento grava esse branch_id no movimento. Em uma organização com caixa aberto por filial e sem caixa central aberto, o pagamento da despesa da filial falhará com “Abra o Caixa para pagar a despesa por ele”, mesmo havendo caixa aberto naquela filial. Se houver caixa central aberto, o movimento da despesa da filial poderá ser lançado no caixa central em vez do caixa da unidade.

A função ativa no Supabase foi consultada com `pg_get_functiondef` e confirma esse comportamento. A migration `20261113010702_use_default_cash_register_for_branch_transactions.sql` já estabelece a regra geral de preferência pelo caixa da filial e fallback para o caixa da organização em outros fluxos. Recomenda-se uma nova migration aditiva que ajuste `pay_expense` para seguir essa mesma regra, com teste para: filial com caixa aberto; filial sem caixa e caixa central aberto; nenhum caixa aberto; despesa sem filial. A correção não foi aplicada nesta etapa.

Observação: `register_cash_movement` não recebe filial e escolhe o caixa central. Isso pode ser intencional para movimentação administrativa geral; não foi classificado como defeito sem uma decisão explícita de produto.

## Estado das migrations e CI
- O Supabase confirmou, por consulta somente leitura, que as versões `20261113034347` e `20261113034736` constam em `supabase_migrations.schema_migrations`.
- No HEAD da branch de recuperação, os workflows `Agenda tests` e `App validation` constam como concluídos com sucesso.
- O status combinado do commit não retornou status checks adicionais.
- O teste de integração contra o Supabase (`npm run test:integration:backend`) não foi executado independentemente nesta auditoria.
- Não houve teste E2E de navegador, teste real com duas organizações ou validação visual desktop/mobile.

## Estado da recuperação
A branch `sync/lovable-finalization-20261113` está 8 commits à frente e 0 atrás de `main`, com 11 arquivos alterados na comparação atual. A PR #1 permanece aberta em modo draft e não foi incorporada. Os 13 SVGs binários já identificados como não recuperados continuam pendentes.

## Próxima ação técnica recomendada
1. Criar migration corretiva e testes específicos para pagamento de despesas por filial, sem editar migrations já aplicadas.
2. Executar localmente build e todos os testes npm disponíveis; depois executar os testes de integração somente com credenciais de teste e dados isolados.
3. Fazer uma matriz de paridade entre funcionalidades do snapshot e os módulos oficiais, portando somente diferenças verificadas.
4. Executar E2E com duas organizações e, separadamente, duas filiais, antes de declarar o SaaS pronto para produção.
