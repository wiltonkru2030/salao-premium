/** Integra o autocomplete compartilhado à carteira da unidade e ao cadastro rápido. */
import {listOwnBookingSlots,slotMessages} from "./working-hours.service.js";
import {toDateKey} from "./utils/formatters.js";
import {selectedUnitArgs} from "./unit-context.js";
import {mountAutocomplete} from "../src/components/autocomplete.js";
import {getProfessionalBookingClients} from "./views/booking.views.js";
import {listUnitCustomers,saveUnitCustomer} from "./customers.service.js";
import {formatSavedPhone} from "../src/utils/input-masks.js";
import {formatMoney} from "./utils/formatters.js";
import {matchesSearch,matchesPhone,searchCatalog} from "./utils/search.js";

/** Apresenta sugestões sem bloquear nem sobrescrever a hora escolhida manualmente.
 * O servidor continua sendo a autoridade sobre disponibilidade na gravação.
 */
export function applyBookingSlots({suggestions,slotStatus,result}){
 const times=[...new Set((result.slots||[]).filter(time=>typeof time==="string"&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)))].sort();
 const option=(label,value)=>{const node=suggestions.ownerDocument.createElement("option");node.textContent=label;node.value=value;return node;};
 suggestions.replaceChildren(option(times.length?"Escolher horário livre":"Nenhum horário livre",""),...times.map(time=>option(time,time)));
 suggestions.disabled=times.length===0;
 slotStatus.textContent=times.length?"Escolha uma sugestão ou informe a hora diretamente.":(result.reason==="available"?"Não foi possível interpretar as sugestões. Atualize os horários.":slotMessages[result.reason]||slotMessages.no_slots);
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
 const label=customer=>customer.name;
 const disposeClient=mountAutocomplete(input,{
  search:async term=>searchBookingClients(await getCustomers(),term),getLabel:label,
  rich:true,getPrimary:label,getSecondary:customer=>formatSavedPhone(customer.phone)||"Telefone não informado",
  placeholder:"Nenhum cliente encontrado",onSelect(){},
  onEmptyAction:unitBooking?term=>showQuick(term):null,emptyActionLabel:"Cadastrar novo cliente"
 });
 const slotsEnabled=form.dataset.availableSlots==="true",hour=form.querySelector("[name=start]"),suggestions=form.querySelector("[data-booking-suggestions]"),slotStatus=form.querySelector("[data-booking-slot-status]"),retry=form.querySelector("[data-booking-retry]");
 let request=0,selectedService=null;
 function setSuggestionPlaceholder(text){
  if(!suggestions)return;
  const option=suggestions.ownerDocument.createElement("option");option.value="";option.textContent=text;
  suggestions.replaceChildren(option);suggestions.disabled=true;
 }
 async function updateSlots(service){
  if(!slotsEnabled)return;
  selectedService=service;
  const seq=++request;retry.hidden=true;
  setSuggestionPlaceholder(service?"Consultando horários…":"Selecione um serviço primeiro");
  slotStatus.textContent=service?"Consultando sugestões. Você já pode informar a hora.":"Informe a hora diretamente ou selecione um serviço para ver sugestões.";
  if(!service)return;
  let timer;
  try{
   const result=await Promise.race([listOwnBookingSlots(client,{org:organizationId,unit:state.branchId||state.professional.branch_id,service:service.id,day:toDateKey(state.selectedDate)}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error("A consulta demorou demais.")),12000);})]);
   if(!current()||seq!==request)return;
   applyBookingSlots({suggestions,slotStatus,result});
   retry.hidden=false;
  }catch(error){if(current()&&seq===request){setSuggestionPlaceholder("Sugestões indisponíveis");slotStatus.textContent="Não foi possível consultar os horários livres. Atualize a lista ou informe a hora diretamente; o servidor conferirá a disponibilidade.";retry.hidden=false;}}
  finally{clearTimeout(timer);}
 }
 const chooseSuggestion=()=>{if(suggestions.value)hour.value=suggestions.value;};
 const refreshSuggestions=()=>void updateSlots(selectedService);
 const manualHourChanged=()=>{if(suggestions&&suggestions.value!==hour.value)suggestions.value="";};
 suggestions?.addEventListener("change",chooseSuggestion);retry?.addEventListener("click",refreshSuggestions);hour.addEventListener("input",manualHourChanged);
 const disposeService=mountAutocomplete(form.querySelector("[data-booking-service]"),{
  search:term=>searchCatalog(state.services,term),
  rich:true,getLabel:service=>service.name,getPrimary:service=>service.name,
  getSecondary:service=>service.duration_minutes+" min · "+formatMoney(service.price),
  placeholder:"Nenhum serviço vinculado encontrado",onSelect:service=>void updateSlots(service)
 });
 const quick=dialog.querySelector("#professional-booking-quick-customer");
 const back=quick?.querySelector("[data-booking-quick-back]");
 /** Reaproveita o termo pesquisado sem confundir nome e telefone. */
 const showQuick=term=>{
  if(!current()||!quick)return;
  quick.reset();quick.querySelector("[data-quick-customer-error]").hidden=true;
  const value=String(term||"").trim(),digits=value.replace(/\D/g,"");
  const phone=/^[\d\s()+.-]+$/.test(value)&&digits.length>=10&&digits.length<=11;
  if(phone)quick.querySelector("[name=phone]").value=formatSavedPhone(digits);
  else if(/\p{L}/u.test(value))quick.querySelector("[name=name]").value=value.slice(0,120);
  form.hidden=true;quick.hidden=false;quick.querySelector(phone?"[name=name]":quick.querySelector("[name=name]").value?"[name=phone]":"[name=name]").focus();
 };
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
  active=false;request++;disposeClient();disposeService();if(slotsEnabled){setSuggestionPlaceholder("Selecione um serviço primeiro");retry.hidden=true;slotStatus.textContent="Você também pode informar a hora diretamente.";}
  suggestions?.removeEventListener("change",chooseSuggestion);retry?.removeEventListener("click",refreshSuggestions);hour.removeEventListener("input",manualHourChanged);
  back?.removeEventListener("click",showBooking);
  quick?.removeEventListener("submit",saveQuick);dialog.removeEventListener("close",dispose);
  form.hidden=false;form.reset();
  delete input.dataset.selectedId;delete form.querySelector("[data-booking-service]").dataset.selectedId;
  if(quick){quick.hidden=true;quick.reset();quick.querySelector("[data-quick-customer-error]").hidden=true;}
  bindings.delete(form);
 };
 if(quick){back.addEventListener("click",showBooking);quick.addEventListener("submit",saveQuick);}
 dialog.addEventListener("close",dispose);bindings.set(form,dispose);
}
