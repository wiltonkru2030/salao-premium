/** Controlador do registro de serviços em comandas profissionais. Protege contexto e submissões simultâneas. */
import {mountAutocomplete} from "../src/components/autocomplete.js";
import {formatMoney as money} from "./utils/formatters.js";
import {canRegisterProfessionalService} from "./access.rules.js";
import {addProfessionalServiceToOrder} from "./order-items.service.js";
/** Vincula a busca e o registro de serviço; retorna a limpeza dos eventos e da busca. */
export function bindOrderService({root,state,client,getEpoch,lock,loadOrders,chooseOrder,showNotice,reportError}){
 const input=root.querySelector("#service-search"),button=root.querySelector("#add-service");if(!input||!button)return null;

 let selected=null;
 const dispose=mountAutocomplete(input,{
  search:async term=>state.services.filter(s=>s.name.toLocaleLowerCase("pt-BR").includes(term.toLocaleLowerCase("pt-BR"))).slice(0,8),
  getLabel:item=>item.name+" · "+money(item.price),
  onSelect:item=>{selected=item;button.disabled=!item;}
 });
 const click=async()=>{
  if(lock.active||!selected||!state.user||!canRegisterProfessionalService(state,state.selectedOrder))return;
  lock.active=true;
  const epoch=getEpoch();
  const orderId=state.selectedOrder.id;
  const service=selected;
  button.disabled=true;button.textContent="Registrando…";
  try{
   await addProfessionalServiceToOrder({
    client,organizationId:state.orgId,orderId,service,
    professionalId:state.professional.id,userId:state.user.id
   });
   if(epoch!==getEpoch())return;
   await loadOrders();if(epoch!==getEpoch())return;
   if(state.page==="Comandas"&&state.selectedOrder?.id===orderId)await chooseOrder(orderId);
   if(epoch===getEpoch())showNotice("Serviço registrado na comanda.");
  }catch(error){
   reportError(error,{context:"App Profissional > registrar serviço realizado"});
   if(epoch===getEpoch())showNotice("Não foi possível concluir o registro ou atualizar a comanda. Confira os itens antes de tentar novamente.");
  }finally{
   // Garante que o botão não permaneça travado após falhas de gravação ou atualização.
   lock.active=false;
   if(button.isConnected){button.disabled=!selected;button.textContent="Registrar serviço";}
  }
 };
 button.addEventListener("click",click);
 return ()=>{dispose?.();button.removeEventListener("click",click);};
}
