# Matriz, filiais e catálogo

## Aplicado no Supabase
- 20261120165637_branch_catalog_rpc_alignment: services.branch_id opcional, FK composta validada, índice e seis funções de vitrine/reserva/cupom alinhadas. Nenhum serviço existente foi reatribuído.
- 20261120165822_branch_main_integrity_and_professional_read: matriz única por organização (no máximo uma), matriz necessariamente ativa, leitura da filial atribuída ao profissional habilitado.
- Auditoria: nenhuma organização sem exatamente uma matriz ativa na data da consulta; cinco profissionais ativos sem filial e zero conflito futuro identificado entre filial explícita de profissional/agendamento. Não atribuir unidade automaticamente.

## Painel
O cadastro novo permite escolher todas as unidades ou filial ativa; a edição preserva o escopo anterior. O nome da filial aparece no catálogo. As preferências de escopo existentes não foram alteradas.

## Limites e pendências
A migration antiga 20261120110000_branch_scoped_service_catalog ainda requer conciliação com as migrations efetivamente aplicadas; não executá-la automaticamente sem revisão das políticas. As candidatas docs/sql/branch-service-write-guards.draft.sql e branch-service-professional-rls.draft.sql aguardam teste de integração. O filtro público já foi aplicado, mas escrita direta de serviço exclusivo na Agenda/Comanda e acesso profissional ao catálogo exigem homologação dos novos guardas. Não considerar isolamento integral por filial concluído: org_memberships não possui branch_id; permissões de recepção/gerência/financeiro continuam vinculadas à organização. Garantia de existência permanente da matriz, inativação segura de filial com atendimentos e caixa aberto, filtros de operações internas, sincronização de contexto e E2E entre aplicativos permanecem pendentes.
15 verificações estáticas do código relido (não equivalem a testes executados). Nenhum merge, cadastro fictício, contratação ou alteração de profissionais efetuados.
