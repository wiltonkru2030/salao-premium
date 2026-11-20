/**
 * Valida regras puras de expediente e exceções de agenda.
 * O PostgreSQL continua sendo a autoridade final para autorização e conflitos.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIME=/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
export function requireUuid(value,label="Identificador"){
 if(typeof value!=="string"||!UUID.test(value.trim())) throw new TypeError(label+" inválido.");
 return value.trim();
}
export function validateWeeklyInterval(input,{professional=false}={}){
 if(!input||typeof input!=="object") throw new TypeError("Informe os dados do expediente.");
 const weekday=Number(input.weekday);
 const start=input[professional?"startsAt":"opensAt"];
 const end=input[professional?"endsAt":"closesAt"];
 if(!Number.isInteger(weekday)||weekday<0||weekday>6) throw new TypeError("Selecione um dia da semana válido.");
 if(typeof start!=="string"||!TIME.test(start)||typeof end!=="string"||!TIME.test(end)||start>=end)
  throw new TypeError("O horário final deve ser posterior ao inicial.");
 return {weekday,[professional?"starts_at":"opens_at"]:start,[professional?"ends_at":"closes_at"]:end,active:input.active!==false};
}
export function validateDateRange(input){
 if(!input||typeof input!=="object") throw new TypeError("Informe o período.");
 const startsAt=new Date(input.startsAt), endsAt=new Date(input.endsAt);
 if(!Number.isFinite(startsAt.getTime())||!Number.isFinite(endsAt.getTime())||endsAt<=startsAt)
  throw new TypeError("O fim do período deve ser posterior ao início.");
 return {starts_at:startsAt.toISOString(),ends_at:endsAt.toISOString()};
}
