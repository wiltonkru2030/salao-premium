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
