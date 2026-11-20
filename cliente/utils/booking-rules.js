/** Regras puras de seleção de horário e cupom na Área da Cliente. */
/** Valida o horário exibido e rejeita alterações de data, profissional ou cupom antes da reserva. */
export function validateBookingSelection({index,slotsState,date,professionalId,enteredCode,couponState}){
 const slot=Number.isInteger(index)&&index>=0?slotsState.items[index]:null;
 if(!slot||!slotsState.serviceId)throw new Error("Selecione um horário válido.");
 if(date!==slotsState.date||(professionalId||null)!==(slotsState.professionalId||null))throw new Error("A seleção mudou. Consulte novamente os horários disponíveis.");
 const couponCode=couponState.serviceId===slotsState.serviceId&&couponState.code===enteredCode&&couponState.preview?couponState.code:null;
 if(enteredCode&&!couponCode)throw new Error("Aplique e valide novamente o cupom antes de reservar o horário.");
 return {slot,couponCode};
}
/** Verifica o vencimento informado pelo banco antes da confirmação da reserva. */
export function isHoldExpired(hold,now=Date.now()){
 const expires=Date.parse(hold?.expiresAt);
 return !Number.isFinite(expires)||expires<=now;
}

/** Valida a alteração solicitada contra as permissões retornadas pelo servidor. */
export function prepareAppointmentChange({id,items,options,action}){
 const item=items.find(row=>row.appointment_id===id),allowed=options.find(row=>row.appointment_id===id);
 if(!id||!item||!allowed||!(action==="cancel"?allowed.can_cancel:action==="reschedule"&&allowed.can_reschedule))throw new Error("Este agendamento não pode ser alterado pelo aplicativo.");
 return {appointmentId:id,action,expectedStart:item.starts_at,timezone:allowed.timezone,date:"",slots:[],newStart:null,searched:false};
}
/** Rejeita índices ausentes, datas alteradas e horários fora da consulta atual. */
export function selectRescheduleStart(change,rawIndex,date){
 const index=Number(rawIndex);
 if(rawIndex==null||String(rawIndex).trim()===""||!Number.isInteger(index)||index<0||!change?.slots?.[index]?.starts_at)throw new Error("Escolha um horário válido.");
 if(date!==change.date)throw new Error("A data mudou. Consulte os horários novamente.");
 return change.slots[index].starts_at;
}
