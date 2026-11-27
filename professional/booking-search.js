/** Integra o autocomplete compartilhado à carteira da unidade e ao cadastro rápido. */
import {listOwnBookingSlots,slotMessages} from "./working-hours.service.js";
import {toDateKey} from "./utils/formatters.js";
import {selectedUnitArgs} from "./unit-context.js";
import {mountAutocomplete} from "../src/components/autocomplete.js";
import {getProfessionalBookingClients} from "./views/booking.views.js";
import {listUnitCustomers,saveUnitCustomer} from "./customers.service.js";
import {formatMoney} from "./utils/formatters.js";
import {matchesSearch,matchesPhone,searchCatalog} from "./utils/search.js";

/** Atualiza controles de horário depois da resposta do servidor.
 * Aceita somente HH:mm válidos, sem duplicatas; não deixa o texto de carregamento
 * depois de uma consulta concluída. O servidor revalida na gravação.
 */
export function applyBookingSlots({hour,submit,slotStatus,result}){
 const times=[...new Set((result.slots||[]).filter(time=>typeof time==="string"&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)))].sort();
 const option=(label,value)=>{const node=hour.ownerDocument.createElement("option");node.textContent=label;node.value=value;return node;};
 hour.replaceChildren(option(times.length?"Selecione o horário":"Nenhum horário disponível",""),...times.map(time=>option(time,time)));
 hour.disabled=times.length===0;submit.disabled=hour.disabled;
 hour.value=times[0]||"";
 slotStatus.textContent=times.length?slotMessages.available:(result.reason==="available"?"Não foi possível interpretar os horários. Selecione o serviço novamente.":slotMessages[result.reason]||slotMessages.no_slots);
}
const bindings=new WeakMap();
/** Filtra clientes por nome ou telefone e evita exibir o histórico como rótulo. */
export function searchBookingClients(clients,term){
 return clients.filter(customer=>matchesSearch(customer.name,term)||matchesPhone(customer.phone,term)).slice(0,8);
}
/** Monta buscas e cadastro rápido por abertura do modal; libera listeners antigos. */
export function bindProfessionalBookingSearch(form,state,{client,isCurrent=()=>true}={}){
 if(!form||!state.professional)return;
 bindings.get(form)?.();
 const dialog=form.closest("dialog"),input=form.querySelector("[data-booking-client]");
 const unitBooking=form.dataset.unitBooking==="true";
 const organizationId=state.orgId,unitArgs=selectedUnitArgs(state);
 let active=true,customersPromise=null;
 const legacy=getProfessionalBookingClients({appointments:state.appointments,professional:state.professional});
 const current=()=>active&&isCurrent()&&form.isConnected&&dialog.open;
 const getCustomers=()=>unitBooking?(customersPromise??=listUnitCustomers({client,organizationId,...unitArgs}).catch(error=>{customersPromise=null;throw error;})):Promise.resolve(legacy);
 const label=customer=>customer.name+(customer.phone?" · "+customer.phone:"");
 const disposeClient=mountAutocomplete(input,{search:async term=>searchBookingClients(await getCustomers(),term),getLabel:label,placeholder:"Nenhum cliente encontrado",onSelect(){}});
 const slotsEnabled=form.dataset.availableSlots==="true",hour=form.querySelector("[name=start]"),slotStatus=form.querySelector("[data-booking-slot-status]"),submit=form.querySelector("[type=submit]");
 let request=0;
 async function updateSlots(service){
  if(!slotsEnabled)return;
  const seq=++request;hour.disabled=true;submit.disabled=true;hour.innerHTML='<option value="">'+(service?"Consultando horários…":"Selecione um serviço primeiro")+'</option>';slotStatus.textContent="";
  if(!service)return;
  try{
   const result=await listOwnBookingSlots(client,{org:organizationId,unit:state.branchId||state.professional.branch_id,service:service.id,day:toDateKey(state.selectedDate)});
   if(!current()||seq!==request)return;
   applyBookingSlots({hour,submit,slotStatus,result});
  }catch(error){if(current()&&seq===request){hour.replaceChildren();const option=hour.ownerDocument.createElement("option");option.value="";option.textContent="Falha ao consultar horários";hour.add(option);hour.disabled=true;submit.disabled=true;slotStatus.textContent=error.message+" Selecione o serviço novamente para tentar.";}}
 }
 if(slotsEnabled)submit.disabled=true;
 const disposeService=mountAutocomplete(form.querySelector("[data-booking-service]"),{
  search:term=>searchCatalog(state.services,term),
  getLabel:service=>service.name+" · "+service.duration_minutes+" min · "+formatMoney(service.price),
  placeholder:"Nenhum serviço vinculado encontrado",onSelect:service=>void updateSlots(service)
 });
 const quick=dialog.querySelector("#professional-booking-quick-customer");
 const open=form.querySelector("[data-booking-quick-open]"),back=quick?.querySelector("[data-booking-quick-back]");
 const showQuick=()=>{form.hidden=true;quick.hidden=false;quick.querySelector("[name=name]").focus();};
 const showBooking=()=>{quick.hidden=true;form.hidden=false;input.focus();};
 const saveQuick=async event=>{
  event.preventDefault();event.stopPropagation();
  if(!current())return;
  const button=quick.querySelector("[type=submit]"),feedback=quick.querySelector("[data-quick-customer-error]");
  if(button.disabled)return;
  const values=new FormData(quick);button.disabled=true;back.disabled=true;feedback.hidden=true;
  try{
   const saved=await saveUnitCustomer({client,organizationId,...unitArgs,name:values.get("name"),phone:values.get("phone")});
   if(!current())return;
   customersPromise=null;
   input.value="";input.dispatchEvent(new Event("input",{bubbles:true}));
   input.value=label(saved);input.dataset.selectedId=saved.id;
   quick.reset();showBooking();
  }catch(error){if(current()){feedback.textContent=error.message;feedback.hidden=false;}}
  finally{button.disabled=false;back.disabled=false;}
 };
 const dispose=()=>{
  active=false;request++;disposeClient();disposeService();if(slotsEnabled){hour.innerHTML='<option value="">Selecione um serviço primeiro</option>';hour.disabled=true;submit.disabled=true;slotStatus.textContent="";}
  open?.removeEventListener("click",showQuick);back?.removeEventListener("click",showBooking);
  quick?.removeEventListener("submit",saveQuick);dialog.removeEventListener("close",dispose);
  form.hidden=false;form.reset();
  delete input.dataset.selectedId;delete form.querySelector("[data-booking-service]").dataset.selectedId;
  if(quick){quick.hidden=true;quick.reset();quick.querySelector("[data-quick-customer-error]").hidden=true;}
  bindings.delete(form);
 };
 if(quick){open.addEventListener("click",showQuick);back.addEventListener("click",showBooking);quick.addEventListener("submit",saveQuick);}
 dialog.addEventListener("close",dispose);bindings.set(form,dispose);
}
