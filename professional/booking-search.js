/** Integra o autocomplete compartilhado à carteira da unidade e ao cadastro rápido. */
import {mountAutocomplete} from "../src/components/autocomplete.js";
import {getProfessionalBookingClients} from "./views/booking.views.js";
import {listUnitCustomers,saveUnitCustomer} from "./customers.service.js";
import {formatMoney} from "./utils/formatters.js";

const bindings=new WeakMap();
/** Normaliza acentos, espaços e caixa para buscas em português. */
function normalized(value){
 return String(value??"").normalize("NFD").replace(/\p{M}/gu,"").toLocaleLowerCase("pt-BR").trim();
}
/** Filtra clientes por nome ou telefone e evita exibir o histórico como rótulo. */
export function searchBookingClients(clients,term){
 const name=normalized(term),digits=/^[+()\d\s-]+$/.test(term)?term.replace(/\D/g,""):"";
 return clients.filter(customer=>normalized(customer.name).includes(name)||(digits.length>=2&&String(customer.phone||"").replace(/\D/g,"").includes(digits))).slice(0,8);
}
/** Monta buscas e cadastro rápido por abertura do modal; libera listeners antigos. */
export function bindProfessionalBookingSearch(form,state,{client,isCurrent=()=>true}={}){
 if(!form||!state.professional)return;
 bindings.get(form)?.();
 const dialog=form.closest("dialog"),input=form.querySelector("[data-booking-client]");
 const unitBooking=form.dataset.unitBooking==="true";
 const organizationId=state.orgId;
 let active=true,customersPromise=null;
 const legacy=getProfessionalBookingClients({appointments:state.appointments,professional:state.professional});
 const current=()=>active&&isCurrent()&&form.isConnected&&dialog.open;
 const getCustomers=()=>unitBooking?(customersPromise??=listUnitCustomers({client,organizationId}).catch(error=>{customersPromise=null;throw error;})):Promise.resolve(legacy);
 const label=customer=>customer.name+(customer.phone?" · "+customer.phone:"");
 const disposeClient=mountAutocomplete(input,{search:async term=>searchBookingClients(await getCustomers(),term),getLabel:label,placeholder:"Nenhum cliente encontrado",onSelect(){}});
 const disposeService=mountAutocomplete(form.querySelector("[data-booking-service]"),{
  search:term=>state.services.filter(service=>normalized([service.name,service.category,formatMoney(service.price),service.duration_minutes+" min"].join(" ")).includes(normalized(term))).slice(0,8),
  getLabel:service=>service.name+" · "+service.duration_minutes+" min · "+formatMoney(service.price),
  placeholder:"Nenhum serviço vinculado encontrado",onSelect(){}
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
   const saved=await saveUnitCustomer({client,organizationId,name:values.get("name"),phone:values.get("phone")});
   if(!current())return;
   customersPromise=null;
   input.value="";input.dispatchEvent(new Event("input",{bubbles:true}));
   input.value=label(saved);input.dataset.selectedId=saved.id;
   quick.reset();showBooking();
  }catch(error){if(current()){feedback.textContent=error.message;feedback.hidden=false;}}
  finally{button.disabled=false;back.disabled=false;}
 };
 const dispose=()=>{
  active=false;disposeClient();disposeService();
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
