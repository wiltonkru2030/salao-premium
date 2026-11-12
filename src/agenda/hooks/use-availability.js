/** Adaptador legado de disponibilidade. Responsabilidade: calcular horários livres com dados locais de demonstração; não grava no banco. */
import {getAvailableSlots,checkAvailability} from '../services/availability.service.js';
import {appts} from '../../data/index.js';
export function useAvailability(options={}){return {slots:getAvailableSlots({...options,appointments:options.appointments||appts}),validate:candidate=>checkAvailability(candidate,options.appointments||appts,options.settings||{})}}
