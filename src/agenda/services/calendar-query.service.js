/**
 * Consulta de calendário: profissionais, bloqueios e agendamentos por organização e unidade.
 * Não manipula interface nem estado global.
 */
import {listAppointments} from "./agenda.service.js";
/**
 * Carrega dados do intervalo visível.
 * @param {object} options Cliente, organização, unidade e intervalo.
 * @returns {Promise<object>} Dados completos ou erro de consulta.
 */
export async function fetchAgendaCalendar({client,orgId,branchId,start,end}) {
 if(!client?.from||!orgId||!(start instanceof Date)||!(end instanceof Date)||!(end>start))throw new TypeError("Contexto da agenda inválido.");
    let professionalQuery=client.from('professionals').select('id,name,color,active,branch_id')
      .eq('org_id',orgId).eq('active',true);
    let blockQuery=client.from('appointment_blocks').select('id,professional_id,starts_at,ends_at,reason')
      .eq('org_id',orgId).lt('starts_at',end.toISOString()).gt('ends_at',start.toISOString());
    if(branchId) {
      professionalQuery=professionalQuery.eq('branch_id',branchId);
      blockQuery=blockQuery.eq('branch_id',branchId);
    }
    const [proResult,appointmentRows,blockResult]=await Promise.all([
      professionalQuery.order('name'),
      listAppointments({client,orgId:orgId,branchId,startAt:start.toISOString(),endAt:end.toISOString()}),
      blockQuery.limit(500)
    ]);
    if(proResult.error)throw proResult.error;
    if(blockResult.error)throw blockResult.error;

 return {professionals:proResult.data||[],appointments:appointmentRows||[],blocks:blockResult.data||[]};
}
