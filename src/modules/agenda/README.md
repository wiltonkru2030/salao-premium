# Módulo Agenda

API pública atual: `src/agenda/pages/agenda-page.js`; adaptador legado: `src/pages/agenda.js`.

Responsabilidades: calendário Dia/Semana/Mês, filtros, profissionais, agendamentos, bloqueios, conflitos, chegada e integração com Comanda.

Dados: `appointments`, `appointment_blocks`, `appointment_groups`, `professionals`, `services`, `customers`.

Regras multitenant: toda consulta deve limitar `org_id`; unidade deve respeitar `branch_id`; RLS valida papel e profissional no banco. A abertura de grupos deve usar RPC atômica.
