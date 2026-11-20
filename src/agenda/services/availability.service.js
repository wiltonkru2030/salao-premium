/**
 * Serviço local de disponibilidade.
 * Responsabilidade: calcular slots e validar conflitos antes da camada de interface.
 * Segurança: o backend deve repetir todas as validações antes de gravar o agendamento.
 */
import {validateAppointment} from '../utils/conflict.utils.js';
/** Executa validação local de disponibilidade e retorna erros de regra em português. */
export function checkAvailability(candidate,appointments,settings={}){return validateAppointment(candidate,appointments,settings)}
/** Gera horários livres em intervalos configuráveis, respeitando duração, expediente e agendamentos existentes. */
export function getAvailableSlots({date,pro,duration=30,appointments=[],opening='08:00',closing='20:00',step=30}){const result=[];const start=Number(opening.slice(0,2))*60+Number(opening.slice(3,5));const end=Number(closing.slice(0,2))*60+Number(closing.slice(3,5));for(let minute=start;minute+duration<=end;minute+=step){const time=String(Math.floor(minute/60)).padStart(2,'0')+
':'+String(minute%60).padStart(2,'0');const check=checkAvailability({date,pro,time,duration},appointments,{opening,closing});if(check.valid)result.push(time)}return result}
// A API deverá repetir todas as validações e será a autoridade final antes de gravar.
