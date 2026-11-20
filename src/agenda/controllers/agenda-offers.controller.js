/**
 * Controlador da Lista de Espera e Pacotes da Agenda administrativa.
 * DOM, eventos e estado transitório ficam aqui; rede no serviço e marcação na view.
 */
import {esc,toast} from "../../utils.js";
import {reportError} from "../../utils/errors.js";
import {renderAgendaOffers,renderPackageModal,renderPackageItemRows} from "../components/agenda-offers.view.js";
import {
 loadOfferCatalog,searchOfferCustomers,loadServicePackages,saveServicePackage,
 setServicePackageActive,listAppointmentWaitlist,addAppointmentWaitlist,
 setAppointmentWaitlistStatus,findAppointmentWaitlistOpenings,bookAppointmentFromWaitlist
} from "../services/agenda-offers.service.js";

const staffRoles=new Set(["owner","admin","manager","receptionist"]);
const managementRoles=new Set(["owner","admin","manager"]);
function context(state){
 return JSON.stringify([state.user?.id||null,state.organization?.id||null,
  state.branch?.id||null,state.membership?.role||null]);
}
function localDay(timezone,date=new Date()){
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
 return p.year+"-"+p.month+"-"+p.day;
}
function timeLabel(value,timezone){
 return new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:timezone}).format(new Date(value));
}
/** Recompõe somente esta área da página; o calendário permanece montado. */
function paint(ctrl){
 const st=ctrl.data;
 if(!ctrl.root.isConnected)return;
 ctrl.root.innerHTML=renderAgendaOffers({
  tab:st.tab,loading:st.loading,error:st.error,waitlist:st.waitlist,
  matches:st.matches,packages:st.packages,services:st.services,
  professionals:st.professionals,isManager:managementRoles.has(ctrl.state.membership?.role),
  date:st.matchDate,searched:st.searched,timezone:st.timezone
 });
}
/** Consulta as fontes em paralelo; descarta respostas de organização ou sessão anterior. */
async function refresh(ctrl){
 const st=ctrl.data,seq=++ctrl.seq,ctx=context(ctrl.state);
 if(st.loading)return;
 st.loading=true;st.error="";paint(ctrl);
 try{
  const params={client:ctrl.client,orgId:st.orgId,branchId:st.branchId};
  const [catalog,waitlist,packages]=await Promise.all([
   loadOfferCatalog(params),listAppointmentWaitlist(params),loadServicePackages(params)
  ]);
  if(!ctrl.root.isConnected||ctrl.seq!==seq||context(ctrl.state)!==ctx)return;
  Object.assign(st,{...catalog,waitlist,packages,loading:false,loaded:true,error:""});
 }catch(error){
  if(!ctrl.root.isConnected||ctrl.seq!==seq||context(ctrl.state)!==ctx)return;
  st.error=error.message||"Não foi possível carregar a lista de espera.";
  st.loading=false;
  reportError(error,{context:"Agenda > pacotes e lista de espera",notify:false});
 }
 if(ctrl.root.isConnected&&ctrl.seq===seq&&context(ctrl.state)===ctx)paint(ctrl);
}
function openDialog(root,id){
 const dialog=root.querySelector("#"+id);
 if(dialog&&!dialog.open)dialog.showModal();
 return dialog;
}
function packageRows(form){
 const rows=[...form.querySelectorAll(".offer-package-entry")];
 return rows.map((row,i)=>({
  service_id:row.querySelector('[name="service_'+i+'"]')?.value||"",
  quantity:Number(row.querySelector('[name="quantity_'+i+'"]')?.value),
  pause_after_minutes:Number(row.querySelector('[name="pause_'+i+'"]')?.value)
 }));
}
function updatePackageRows(ctrl,items){
 ctrl.data.packageItems=items;
 const host=ctrl.root.querySelector("#offer-package-items");
 if(host)host.innerHTML=renderPackageItemRows({services:ctrl.data.services,items});
}
function openPackageDialog(ctrl,pkg=null){
 if(!managementRoles.has(ctrl.state.membership?.role))return;
 if(pkg&&!pkg.branch_id)throw new Error("Pacotes globais são somente leitura nesta unidade.");
 ctrl.data.editingPackageId=pkg?.id||null;
 ctrl.data.packageItems=(pkg?.items||[{service_id:"",quantity:1,pause_after_minutes:0}]).map(x=>({
  service_id:x.service_id,quantity:x.quantity,pause_after_minutes:x.pause_after_minutes
 }));
 const parent=ctrl.root.querySelector("#offer-package-dialog");
 if(!parent)return;
 const div=document.createElement("div");
 div.innerHTML=renderPackageModal({
  services:ctrl.data.services,name:pkg?.name||"",description:pkg?.description||"",
  referencePrice:pkg?.reference_price??"",items:ctrl.data.packageItems,editing:!!pkg
 });
 parent.replaceWith(div.firstElementChild);
 openDialog(ctrl.root,"offer-package-dialog")?.querySelector('[name="name"]')?.focus();
}
/** Cliques dos botões são convertidos em intenções; nenhuma reserva ocorre sem confirmação. */
async function onClick(ctrl,event){
 const button=event.target.closest?.("[data-offer-action],[data-offer-tab],[data-offer-customer]");
 if(!button||ctrl.data.loading||ctrl.data.busy||context(ctrl.state)!==ctrl.data.ctx)return;
 const st=ctrl.data,root=ctrl.root;
 if(button.dataset.offerTab){
  if(!["waitlist","packages"].includes(button.dataset.offerTab))return;
  st.tab=button.dataset.offerTab;st.error="";paint(ctrl);return;
 }
 if(button.dataset.offerCustomer){
  const customer=st.customerSuggestions.find(row=>row.id===button.dataset.offerCustomer);
  if(!customer)return;
  const form=root.querySelector("#offer-waitlist-form");
  form.elements.customer_id.value=customer.id;
  form.elements.customer_search.value=customer.name;
  root.querySelector("#offer-customer-results").innerHTML="";return;
 }
 const action=button.dataset.offerAction;
 if(action==="close-dialog"){button.closest("dialog")?.close();return;}
 if(action==="new-waitlist"){
  const dialog=openDialog(root,"offer-waitlist-dialog");
  if(dialog){
   dialog.querySelector('[name="from_date"]').value=st.matchDate;
   dialog.querySelector('[name="until_date"]').value=st.matchDate;
   dialog.querySelector('[name="customer_search"]')?.focus();
  }
  return;
 }
 if(action==="new-package"){openPackageDialog(ctrl);return;}
 if(action==="edit-package"){
  const pkg=st.packages.find(row=>row.id===button.dataset.packageId);
  if(pkg)openPackageDialog(ctrl,pkg);
  return;
 }
 if(action==="toggle-package"){
  const pkg=st.packages.find(row=>row.id===button.dataset.packageId);
  if(!pkg||!managementRoles.has(ctrl.state.membership?.role)||!pkg.branch_id)return;
  st.pendingPackage=pkg;
  const dialog=openDialog(root,"offer-package-status-dialog");
  if(dialog)dialog.querySelector("#offer-package-status-summary").textContent=
   (pkg.active?"Inativar":"Reativar")+" o combo “"+pkg.name+"”? O histórico não será apagado.";
  return;
 }
 if(action==="add-package-item"||action==="remove-package-item"){
  const form=root.querySelector("#offer-package-form");if(!form)return;
  const items=packageRows(form);
  if(action==="add-package-item"){
   if(items.length>=20)throw new Error("Um combo permite até vinte etapas.");
   items.push({service_id:"",quantity:1,pause_after_minutes:0});
  }else{
   const index=Number(button.dataset.itemIndex);
   if(!Number.isInteger(index)||index<0||index>=items.length||items.length<=1)return;
   items.splice(index,1);
  }
  updatePackageRows(ctrl,items);return;
 }
 if(action==="search-openings"){
  const date=root.querySelector("#offer-match-date")?.value||"";
  st.matchDate=date;st.matches=[];st.searched=false;st.error="";
  st.loading=true;paint(ctrl);
  try{
   const slots=await findAppointmentWaitlistOpenings({
    client:ctrl.client,orgId:st.orgId,branchId:st.branchId,date
   });
   if(context(ctrl.state)===st.ctx&&ctrl.root.isConnected){
    st.matches=slots;st.searched=true;
   }
  }catch(error){if(context(ctrl.state)===st.ctx)st.error=error.message;}
  finally{if(context(ctrl.state)===st.ctx&&root.isConnected){st.loading=false;paint(ctrl);}}
  return;
 }
 if(action==="preview-match"){
  const index=Number(button.dataset.matchIndex),match=st.matches[index];
  if(!match)return;
  st.selectedMatch=match;
  const dialog=openDialog(root,"offer-book-dialog");
  if(dialog)dialog.querySelector("#offer-book-summary").textContent=
   match.customer_name+" · "+match.service_name+" com "+match.professional_name+
   " em "+timeLabel(match.starts_at,st.timezone)+".";
  return;
 }
 if(action==="contacted"||action==="cancel"){
  const entry=st.waitlist.find(row=>row.waitlist_id===button.dataset.waitlistId);
  if(!entry||!["waiting","contacted"].includes(entry.status))return;
  st.pendingStatus={id:entry.waitlist_id,status:action==="contacted"?"contacted":"cancelled"};
  const dialog=openDialog(root,"offer-status-dialog");
  if(dialog)dialog.querySelector("#offer-status-summary").textContent=
   (action==="contacted"?"Registrar contato com ":"Cancelar solicitação de ")+entry.customer_name+"?";
 }
}
/** Envio de formulários protegido contra cliques repetidos e troca de sessão. */
async function onSubmit(ctrl,event){
 const form=event.target;
 if(!["offer-waitlist-form","offer-package-form","offer-book-form","offer-status-form","offer-package-status-form"].includes(form.id))return;
 event.preventDefault();
 const st=ctrl.data;
 if(st.loading||st.busy||context(ctrl.state)!==st.ctx)return;
 const button=form.querySelector('[type="submit"]');
 st.busy=true;if(button)button.disabled=true;
 try{
  const opts={client:ctrl.client,orgId:st.orgId,branchId:st.branchId};
  if(form.id==="offer-waitlist-form"){
   await addAppointmentWaitlist({...opts,customerId:form.elements.customer_id.value,
    serviceId:form.elements.service_id.value,professionalId:form.elements.professional_id.value||null,
    fromDate:form.elements.from_date.value,untilDate:form.elements.until_date.value,
    fromTime:form.elements.from_time.value,untilTime:form.elements.until_time.value,
    notes:form.elements.notes.value});
   if(context(ctrl.state)===st.ctx)toast("Cliente incluída na lista de espera.");
  }else if(form.id==="offer-package-form"){
   if(!managementRoles.has(ctrl.state.membership?.role))throw new Error("Sem permissão para salvar combos.");
   const data=new FormData(form);
   await saveServicePackage({...opts,packageId:st.editingPackageId,
    name:data.get("name"),description:data.get("description"),
    referencePrice:data.get("reference_price"),items:packageRows(form)});
   if(context(ctrl.state)===st.ctx)toast("Combo salvo no catálogo.");
  }else if(form.id==="offer-book-form"){
   const match=st.selectedMatch;
   if(!match||!st.matches.some(x=>x.waitlist_id===match.waitlist_id&&x.starts_at===match.starts_at))
     throw new Error("O encaixe selecionado não está disponível.");
   await bookAppointmentFromWaitlist({...opts,waitlistId:match.waitlist_id,
    professionalId:match.professional_id,startsAt:match.starts_at});
   if(context(ctrl.state)===st.ctx){
    toast("Encaixe agendado e lista de espera atualizada.");
    st.matches=[];st.searched=false;
   }
  }else if(form.id==="offer-status-form"){
   if(!st.pendingStatus)throw new Error("Selecione a solicitação para alterar.");
   await setAppointmentWaitlistStatus({...opts,waitlistId:st.pendingStatus.id,
    status:st.pendingStatus.status});
   if(context(ctrl.state)===st.ctx)toast("Situação da espera atualizada.");
  }else if(form.id==="offer-package-status-form"){
   if(!st.pendingPackage||!managementRoles.has(ctrl.state.membership?.role))
    throw new Error("Pacote não selecionado.");
   await setServicePackageActive({...opts,packageId:st.pendingPackage.id,active:!st.pendingPackage.active});
   if(context(ctrl.state)===st.ctx)toast("Situação do combo atualizada.");
  }
  if(context(ctrl.state)!==st.ctx||!ctrl.root.isConnected)return;
  form.closest("dialog")?.close();st.busy=false;
  st.pendingStatus=null;st.pendingPackage=null;st.selectedMatch=null;
  await refresh(ctrl);
  if(form.id==="offer-book-form")await ctrl.onBooked?.();
 }catch(error){
  if(context(ctrl.state)===st.ctx&&ctrl.root.isConnected){
   reportError(error,{context:"Agenda > salvar pacotes e encaixes",notify:false});
   st.error=error.message||"Não foi possível concluir a operação.";
   // Preserva o formulário para que o usuário possa corrigir os dados.
   const msg=form.querySelector(".offer-form-error")||document.createElement("p");
   msg.className="offer-form-error";msg.setAttribute("role","alert");msg.textContent=st.error;
   if(!msg.isConnected)form.prepend(msg);
  }
 }finally{
  st.busy=false;
  if(button?.isConnected)button.disabled=false;
 }
}
function onInput(ctrl,event){
 if(event.target.id!=="offer-customer-search"||context(ctrl.state)!==ctrl.data.ctx)return;
 const field=event.target,st=ctrl.data,seq=++ctrl.customerSeq;
 const form=field.closest("form");form.elements.customer_id.value="";
 const results=ctrl.root.querySelector("#offer-customer-results");
 if(field.value.trim().length<2){results.innerHTML="";return;}
 void searchOfferCustomers({client:ctrl.client,orgId:st.orgId,branchId:st.branchId,term:field.value})
 .then(rows=>{
  if(seq!==ctrl.customerSeq||!field.isConnected||context(ctrl.state)!==st.ctx)return;
  st.customerSuggestions=rows;
  results.innerHTML=rows.length?rows.map(row=>
   '<button class="offer-customer-option" data-offer-customer="'+esc(row.id)+'" type="button">'+
   '<strong>'+esc(row.name)+'</strong><small>'+esc(row.phone||"Sem telefone")+'</small></button>').join(""):
   '<p>Nenhuma cliente encontrada. Cadastre-a no módulo Clientes.</p>';
 }).catch(error=>{
  if(seq===ctrl.customerSeq&&field.isConnected){results.textContent=error.message;}
 });
}
/** Instala a área secundária da Agenda. Chamadas repetidas não duplicam listeners. */
export async function mountAgendaOffers({client,state,onBooked}={}){
 const root=document.querySelector("#agenda-offers-panel");
 if(!root||!client||!state)return;
 if(!staffRoles.has(state.membership?.role)){root.innerHTML="";return;}
 if(!state.organization?.id||!state.branch?.id){
  root.innerHTML='<p class="offer-hint">Selecione uma unidade específica para utilizar pacotes e lista de espera.</p>';
  return;
 }
 const ctx=context(state);
 let ctrl=root._offersController;
 if(!ctrl){
  ctrl={root,client,state,onBooked,seq:0,customerSeq:0,data:null};
  root._offersController=ctrl;
  root.addEventListener("click",event=>{void onClick(ctrl,event).catch(error=>{
   if(context(ctrl.state)===ctrl.data.ctx){
    ctrl.data.error=error.message||"Não foi possível concluir a ação.";paint(ctrl);
   }
  });});
  root.addEventListener("submit",event=>{void onSubmit(ctrl,event);});
  root.addEventListener("input",event=>onInput(ctrl,event));
 }
 ctrl.client=client;ctrl.state=state;ctrl.onBooked=onBooked;
 if(ctrl.data?.ctx===ctx&&(ctrl.data.loaded||ctrl.data.loading))return;
 const tz=state.organization?.timezone||"America/Sao_Paulo";
 ctrl.data={
  ctx,orgId:state.organization.id,branchId:state.branch.id,timezone:tz,
  matchDate:localDay(tz),tab:"waitlist",waitlist:[],matches:[],packages:[],
  services:[],professionals:[],customerSuggestions:[],searched:false,
  loaded:false,loading:false,busy:false,error:"",selectedMatch:null,
  pendingStatus:null,pendingPackage:null,editingPackageId:null,packageItems:[]
 };
 await refresh(ctrl);
}
