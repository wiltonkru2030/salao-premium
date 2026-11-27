/** Controla mutações da comanda e busca compartilhada, com isolamento de sessão. */
import {mountAutocomplete} from "../src/components/autocomplete.js";
import {formatMoney} from "./utils/formatters.js";
import {searchCatalog} from "./utils/search.js";
import {canManageOrder,orderItemEditPayload,professionalOrderAction} from "./order-management.service.js";
/** Monta os controles da comanda e retorna a rotina de limpeza dos listeners. */
export function bindOrderManagement({root,state,client,getEpoch,lock,loadOrders,loadAppointments,chooseOrder,showNotice,reportError}){
 const panel=root.querySelector("[data-managed-order]");
 if(!panel||!canManageOrder(state)||state.orderItemsStatus!=="ready")return null;
 const order=state.selectedOrder,epoch=getEpoch(),organizationId=state.orgId;
 const current=()=>getEpoch()===epoch&&state.page==="Comandas"&&state.selectedOrder?.id===order.id&&state.orgId===organizationId;
 const rpc=(operation,payload)=>professionalOrderAction({client,organizationId,order,operation,payload});
 const errorBox=panel.querySelector("[data-managed-order-error]"),selected={service:null,product:null},disposers=[];
 let products=null;
 const filter=(rows,term)=>searchCatalog(rows,term);
 for(const type of ["service","product"]){
  const input=panel.querySelector("[data-managed-"+type+"]"),button=panel.querySelector('[data-managed-add="'+type+'"]');
  disposers.push(mountAutocomplete(input,{
   search:async term=>filter(type==="service"?state.services:(products??=await rpc("products")),term),
   getLabel:item=>item.name+" · "+formatMoney(item.price),
   onSelect:item=>{selected[type]=item;button.disabled=!item;}
  }));
 }
 /** Uma gravação por vez; falha de atualização não é tratada como falha de gravação. */
 async function mutate(control,operation,payload){
  if(!current()||lock.active||control.disabled)return;
  const token=Symbol("comanda");lock.active=true;lock.operation=token;control.disabled=true;errorBox.hidden=true;
  try{
   await rpc(operation,payload);
   if(!current())return;
   try{
    await loadOrders();
    if(operation==="cancel")await loadAppointments();
    if(!current())return;
    await chooseOrder(order.id);
    if(current())showNotice(operation==="cancel"?"Comanda cancelada.":"Comanda atualizada.");
   }catch(error){if(current())showNotice("Alteração registrada. Atualize a lista para conferir o resultado.");}
  }catch(error){if(current()&&errorBox.isConnected){reportError(error,{context:"App Profissional > alterar comanda"});errorBox.textContent=error.message;errorBox.hidden=false;}}
  finally{if(lock.operation===token){lock.active=false;lock.operation=null;}if(control.isConnected)control.disabled=false;}
 }
 const click=event=>{
  const add=event.target.closest("[data-managed-add]");
  if(add){const type=add.dataset.managedAdd;if(selected[type])void mutate(add,type,{[type]:selected[type].id});return;}
  const remove=event.target.closest("[data-managed-remove]");
  if(remove&&window.confirm("Remover este item da comanda?")){void mutate(remove,"remove",{id:remove.dataset.managedRemove});return;}
  const cancel=event.target.closest("[data-managed-cancel]");
  if(cancel&&window.confirm("Cancelar esta comanda e os atendimentos vinculados?"))void mutate(cancel,"cancel",{});
 };
 const submit=event=>{
  const form=event.target.closest("[data-managed-item-form]");if(!form)return;
  event.preventDefault();event.stopPropagation();
  try{
   const item=state.orderItems.find(row=>row.id===form.dataset.managedItemForm&&row.professional_id===state.professional.id);
   const values=new FormData(form),payload=orderItemEditPayload(item,values.get("quantity"),values.get("discount"));
   void mutate(form.querySelector("[type=submit]"),"edit",payload);
  }catch(error){errorBox.textContent=error.message;errorBox.hidden=false;}
 };
 panel.addEventListener("click",click);panel.addEventListener("submit",submit);
 return ()=>{disposers.forEach(dispose=>dispose());panel.removeEventListener("click",click);panel.removeEventListener("submit",submit);};
}
