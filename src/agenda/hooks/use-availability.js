/** Adaptador legado de disponibilidade. Responsabilidade: calcular horários livres com dados locais de demonstração; não grava no banco. */
import {getAvailableSlots,checkAvailability} from '../services/availability.service.js';
import {appts} from '../../data/index.js';
/**
 * Expõe horários livres e validação de conflitos para a Agenda.
 * @param {object} options Configurações, agendamentos e intervalos candidatos.
 * @returns {{slots:Array,validate:Function}} Horários calculados e função de validação.
 */
export function useAvailability(options={}){return {slots:getAvailableSlots({...options,appointments:options.appointments||appts}),validate:candidate=>checkAvailability(candidate,options.appointments||appts,options.settings||{})}}
