/**
 * Adaptadores assíncronos do repositório Supabase da Agenda.
 * Responsabilidade: encaminhar consultas e prévias com cliente e organização explícitos.
 * Ecossistema: hooks/serviços da Agenda administrativa.
 */

/**
 * Lista agendamentos persistidos da organização ativa.
 * @param {object} filters Filtros de data, profissional, status e busca.
 * @param {object} context Cliente Supabase e orgId.
 * @returns {Promise<Array<object>>} Registros reais.
 */
import { agendaRepository, previewCreateAppointment } from "../services/agenda.service.js";

export function useAppointments(filters={},context={}) {
  return agendaRepository.list(filters,context);
}

/**
 * Busca um agendamento persistido por UUID.
 * @param {string} id Identificador do registro.
 * @param {object} context Cliente Supabase e orgId.
 * @returns {Promise<object|null>} Registro ou null.
 */
export function useAppointment(id,context={}) {
  return agendaRepository.get(id,context);
}

/**
 * Gera prévia de criação sem gravar no banco.
 * @param {object} input Dados do atendimento.
 * @param {object} context Cliente Supabase, organização e expediente.
 * @returns {Promise<object>} Resultado de validação.
 */
export function previewAppointment(input,context={}) {
  return previewCreateAppointment(input,context);
}
