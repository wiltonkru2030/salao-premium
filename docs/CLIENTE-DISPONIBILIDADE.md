# Disponibilidade da Área da Cliente

O banco já possui expediente por unidade, expediente por profissional, fechamentos, folgas, bloqueios, agendamentos e HOLDs ativos.

A função proposta em docs/sql/customer-availability-slots.draft.sql calcula horários candidatos no fuso da organização e exclui conflitos conhecidos. A função de criação do HOLD continua sendo a autoridade final: ela repete as validações e grava a reserva sob lock transacional.

O rascunho não foi aplicado ao Supabase. A interface de descoberta de salões e seleção de serviço ainda precisa ser concluída antes de expor a consulta à cliente.
