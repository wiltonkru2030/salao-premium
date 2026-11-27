/** Expediente próprio, consultado com RLS e alterado por RPC que protege atendimentos futuros. */
import {validateWeeklyInterval} from "../src/modules/availability/availability.utils.js";
export async function loadOwnWorkingHours(client,org,professional){
 const {data,error}=await client.from("professional_working_hours").select("id,weekday,starts_at,ends_at,active").eq("org_id",org).eq("professional_id",professional).order("weekday").order("starts_at");
 if(error)throw new Error("Não foi possível consultar seu expediente.");
 return data||[];
}
export async function saveOwnWorkingHours(client,org,{id=null,weekday,startsAt,endsAt,remove=false}){
 const row=remove?null:validateWeeklyInterval({weekday,startsAt,endsAt},{professional:true});
 const {data,error}=await client.rpc("save_own_professional_working_hours",{target_org:org,target_entry:id,target_weekday:row?.weekday??null,target_start:row?.starts_at??null,target_end:row?.ends_at??null,remove_entry:remove});
 if(error?.code==="23P01")throw new Error("Já existe um expediente nesse intervalo.");
 if(error?.code==="23514")throw new Error("Essa alteração deixaria um atendimento futuro fora do expediente.");
 if(error||!data)throw new Error("Não foi possível salvar o expediente. Confira sua permissão e tente novamente.");
 return data;
}
export async function listOwnBookingSlots(client,{org,unit,service,day}){
 const {data,error}=await client.rpc("list_own_professional_booking_slots",{target_org:org,target_unit:unit,target_service:service,target_day:day});
 if(error||!Array.isArray(data?.slots))throw new Error("Não foi possível consultar os horários disponíveis.");
 return data;
}
export const slotMessages={branch_closed:"O salão não tem expediente cadastrado para este dia. A administração deve configurar o horário da unidade.",professional_closed:"Você não tem expediente neste dia. Abra Perfil → Configurações → Meu expediente.",invalid_day:"Selecione hoje ou uma data futura, dentro dos próximos 366 dias.",no_slots:"Não há horários livres para a duração desse serviço. Selecione outro dia.",available:"Escolha um horário disponível no fuso do salão."};
