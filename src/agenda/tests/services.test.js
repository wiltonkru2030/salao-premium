/** Testes unitários: operações do repositório local legado da Agenda, isoladas dos dados do salão. */
import {appts} from '../../data/index.js';
import {createAppointment,updateAppointment,changeAppointmentStatus} from '../services/agenda.service.js';
export function runAgendaServiceChecks(){
 const originalLength=appts.length;
 const base={name:'Teste automatizado',service:'Corte',pro:2,date:'2027-02-10',time:'09:00',duration:60,status:'Aguardando'};
 const created=createAppointment(base);
 const checks=[];
 checks.push(['cria agendamento válido em memória',created.ok&&appts.length===originalLength+1]);
 const duplicate=createAppointment({...base,name:'Outro cliente'});
 checks.push(['impede conflito no mesmo profissional',!duplicate.ok&&appts.length===originalLength+1]);
 const moved=created.ok?updateAppointment(created.appointment.id,{time:'10:00'}):{ok:false};
 checks.push(['atualiza horário sem conflito',moved.ok&&appts.find(a=>a.id===created.appointment.id)?.time==='10:00']);
 const status=created.ok?changeAppointmentStatus(created.appointment.id,'Confirmado'):{ok:false};
 checks.push(['atualiza status',status.ok&&appts.find(a=>a.id===created.appointment.id)?.status==='Confirmado']);
 if(created.ok){const index=appts.findIndex(a=>a.id===created.appointment.id);if(index>=0)appts.splice(index,1)}
 return {passed:checks.filter(x=>x[1]).length,total:checks.length,checks};
}
