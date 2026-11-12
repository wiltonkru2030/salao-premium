import {appts} from '../../data/index.js';
import {checkAvailability} from './availability.service.js';
export function listAppointments({date,pro}={}){return appts.filter(a=>(!date||a.date===date)&&(pro===undefined||pro===null||a.pro===pro)).map(a=>({...a}))}
export function getAppointment(id){const item=appts.find(a=>a.id===Number(id));return item?{...item}:null}
export function previewCreateAppointment(input){const validation=checkAvailability(input,appts);return {ok:validation.valid,errors:validation.errors,preview:{...input}}}
export function previewMoveAppointment(id,changes){const current=appts.find(a=>a.id===Number(id));if(!current)return {ok:false,errors:['Agendamento não encontrado.']};const candidate={...current,...changes};const validation=checkAvailability(candidate,appts);return {ok:validation.valid,errors:validation.errors,preview:candidate}}
// Adaptador temporário de demonstração. Substituir por chamadas HTTP sem alterar os componentes.
export const agendaRepository={list:listAppointments,get:getAppointment,create:previewCreateAppointment,move:previewMoveAppointment};
