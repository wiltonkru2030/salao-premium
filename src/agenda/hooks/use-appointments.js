/** Adaptador legado de agendamentos. Responsabilidade: consultar o repositório local em memória; não é o fluxo Supabase do painel. */
import {agendaRepository} from '../services/agenda.service.js';
export function useAppointments(filters={}){return agendaRepository.list(filters)}
export function useAppointment(id){return agendaRepository.get(id)}
export function previewAppointment(input){return agendaRepository.create(input)}
