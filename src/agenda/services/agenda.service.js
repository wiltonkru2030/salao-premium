/**
 * Repositório legado da Agenda.
 * Responsabilidade: listar/criar/atualizar dados em memória para testes e demonstrações; não é persistência real.
 * Atenção: não utilizar como confirmação de gravação no Supabase ou como fonte final de disponibilidade.
 */
import {appts} from '../../data/index.js';
import {checkAvailability} from './availability.service.js';

/** Lista cópias dos agendamentos locais aplicando filtros opcionais de data, profissional, status e busca. */
export function listAppointments({date,pro,status,query}={}) {
  const q=String(query||'').trim().toLocaleLowerCase('pt-BR');
  return appts.filter(a=>(!date||a.date===date)&&(pro===undefined||pro===null||a.pro===pro)&&(!status||status==='Todos'||a.status===status)&&(!q||[a.name,a.service,a.phone].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(q)))).map(a=>({...a}));
}
/** Busca agendamento pelo identificador numérico e retorna cópia ou null. */
export function getAppointment(id){const item=appts.find(a=>a.id===Number(id));return item?{...item}:null}
/** Valida dados de novo agendamento e devolve uma prévia sem alterar a coleção local. */
export function previewCreateAppointment(input){const validation=checkAvailability(input,appts);return {ok:validation.valid,errors:validation.errors,preview:{...input}}}
/** Cria agendamento na coleção local após validação; não persiste no backend. */
export function createAppointment(input){
  const candidate={...input,id:Math.max(0,...appts.map(a=>Number(a.id)||0))+1,status:input.status||'Aguardando'};
  const validation=checkAvailability(candidate,appts);
  if(!validation.valid)return {ok:false,errors:validation.errors};
  appts.push(candidate);return {ok:true,appointment:{...candidate}};
}
/** Atualiza agendamento local existente após validar o novo estado e possíveis conflitos. */
export function updateAppointment(id,changes){
  const index=appts.findIndex(a=>a.id===Number(id));
  if(index<0)return {ok:false,errors:['Agendamento não encontrado.']};
  const candidate={...appts[index],...changes,id:Number(id)};
  const validation=checkAvailability(candidate,appts);
  if(!validation.valid)return {ok:false,errors:validation.errors};
  appts[index]=candidate;return {ok:true,appointment:{...candidate}};
}
/** Simula reagendamento sem salvar alterações na coleção local. */
export function previewMoveAppointment(id,changes){const current=appts.find(a=>a.id===Number(id));if(!current)return {ok:false,errors:['Agendamento não encontrado.']};const candidate={...current,...changes};const validation=checkAvailability(candidate,appts);return {ok:validation.valid,errors:validation.errors,preview:candidate};}
/** Altera status do agendamento local; deve ser substituído por operação persistida no fluxo real. */
export function changeAppointmentStatus(id,status){
  const item=appts.find(a=>a.id===Number(id));if(!item)return {ok:false,errors:['Agendamento não encontrado.']};
  item.status=status;return {ok:true,appointment:{...item}};
}
// Repositório local temporário. Substituir a implementação por API sem alterar os componentes.
/** Fachada compatível com os componentes antigos da Agenda durante a migração do repositório local. */
export const agendaRepository={list:listAppointments,get:getAppointment,create:createAppointment,move:previewMoveAppointment,update:updateAppointment};
