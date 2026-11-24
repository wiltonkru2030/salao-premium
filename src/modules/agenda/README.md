# Módulo Agenda

Página e consulta: `src/agenda/pages/agenda-page.js`; eventos: `src/agenda/controllers/agenda-controller.js`; ações e gravações: `src/agenda/controllers/appointment-actions.js`; adaptador legado: `src/pages/agenda.js`.

Responsabilidades: calendário Dia/Semana/Mês, filtros, profissionais, agendamentos, bloqueios, conflitos, chegada e integração com Comanda.

Dados: `appointments`, `appointment_blocks`, `appointment_groups`, `professionals`, `services`, `customers`.

Regras multitenant: toda consulta deve limitar `org_id`; unidade deve respeitar `branch_id`; RLS valida papel e profissional no banco. A abertura de grupos deve usar RPC atômica.

## Revisão 24/11/2026 — regras e aceite

- Calendário diário/semanal/mensal, régua de horários, seleção de profissional com foto/nome, duração por serviço, bloqueios, expediente e folgas. Arrastar/reagendar, falta, início, conclusão e cancelamento são requisitos a verificar em navegador.
- Preservar serviço, cliente, profissional, origem, unidade e horário; impedir conflitos e vínculos cruzados no banco. A RPC start_appointment_group_service_order abre atendimento agrupado atomicamente.
- `src/agenda/services/agenda-offers.service.js`: fila de espera, busca de encaixes e pacotes. Migrations 20261120212042, 20261120212306 e 20261120212554 documentam tabelas service_packages, service_package_items e appointment_waitlist, RPCs de gestão e reserva atômica. Cancelamento libera encaixe quando previsto; testar concorrência.
- Integrações: Orçamentos, App Cliente, App Profissional, Comanda, disponibilidade e catálogo. Não criar comissão por agendamento.
- Testes: npm run test:agenda, test:availability, test:agenda-offers, test:agenda-offers-session, test:sql-appointment-offers (com npm run). Homologar dois tenants, duas filiais, conflitos simultâneos e visual desktop/mobile.

Ver [README mestre](../../../README.md). Aplicar CSS global, modais/listas padronizados, máscaras, comentários JSDoc e erros pt-BR. Os testes não foram executados nesta revisão documental.
