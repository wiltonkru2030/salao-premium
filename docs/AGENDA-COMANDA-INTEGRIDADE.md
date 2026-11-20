# Integridade Agenda e Comanda

Data: 20/11/2026. Candidata: docs/sql/agenda-order-branch-idempotency.draft.sql.

O painel restringe busca de comandas à organização, cliente e unidade exata (inclusive unidade legada nula). Só oferece comandas abertas/em andamento; não permite trocar unidade de agendamento já vinculado. A preferência de criar nova comanda não sobrescreve vínculo existente.

O SQL candidato preserva as assinaturas públicas e permissões existentes, bloqueia grupo antes dos agendamentos e comanda, trata autorização nula como negativa, verifica cliente/unidade, preserva o item de origem e o estado financeiro já iniciado, impede inclusão de novo atendimento após recebimento confirmado e rejeita vínculos contraditórios. Não foi aplicado. A regra de bloquear inclusão após pagamento preserva a base de cálculo das comissões congeladas; precisa de homologação operacional.

Auditoria somente leitura do banco: 0 vínculos incompatíveis, 0 divergências entre comanda de origem e item, 0 grupos ativos divididos. A existência do índice único service_order_items_source_appointment_unique foi confirmada. Esses resultados não demonstram que a candidata funciona em execução.

15 condições estáticas conferidas. Teste incluído em test:all, CI não confirmada. Testar em QA: repetição de clique e requisições paralelas; grupos com vários profissionais; unidade distinta; recebimento parcial; comanda fechada; autorização nula; alteração concorrente de grupo; rollback por conflito. Revisar edição direta de vínculos sob RLS, restrições do app profissional e substituir confirm/prompt do navegador por modal do design system.

Nenhum dado do banco alterado. Não liberar sem integração, revisão de concorrência e validação das permissões.
