import {timeToMinutes} from './duration.utils.js';
export function findConflict(items,candidate,ignoreId=candidate.id){
 const start=timeToMinutes(candidate.time),end=start+Number(candidate.duration||0);
 return items.find(item=>item.id!==ignoreId&&item.date===candidate.date&&item.pro===candidate.pro&&start<timeToMinutes(item.time)+Number(item.duration||0)&&end>timeToMinutes(item.time))||null;
}
export function validateAppointment(candidate,items,{opening='08:00',closing='20:00',allowOverlap=false}={}){
 const errors=[];
 if(!String(candidate.name||'').trim())errors.push('Informe o nome do cliente.');
 if(!String(candidate.service||'').trim())errors.push('Informe o serviço.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(candidate.date||''))errors.push('Informe uma data válida.');
 else {const d=new Date(candidate.date+'T12:00:00');if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==candidate.date)errors.push('A data informada não existe.')}
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(candidate.time||''))errors.push('Informe um horário válido.');
 if(!Number.isInteger(Number(candidate.duration))||Number(candidate.duration)<=0||Number(candidate.duration)>720)errors.push('A duração deve ser um número inteiro entre 1 e 720 minutos.');
 if(!Number.isInteger(Number(candidate.pro))||Number(candidate.pro)<0)errors.push('Selecione um profissional válido.');
 if(!errors.length){
  const start=timeToMinutes(candidate.time),end=start+Number(candidate.duration);
  if(start<timeToMinutes(opening)||end>timeToMinutes(closing))errors.push('O atendimento deve ficar entre '+opening+' e '+closing+'.');
  if(!allowOverlap){const conflict=findConflict(items,candidate);if(conflict)errors.push('Conflito com '+conflict.name+' às '+conflict.time+'.')}
 }
 return {valid:errors.length===0,errors};
}
