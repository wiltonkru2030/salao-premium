/** createFinancialController — coordena estado e serviços; não possui sessão global. */
import {fetchProfessionalOrders,fetchProfessionalOrderItems} from "../orders.service.js";
import {fetchProfessionalCommissions} from "../commissions.service.js";

/** Recebe dependências e retorna operações do módulo. Respostas antigas são descartadas por geração de sessão. */
export function createFinancialController({state,supabase,getEpoch,render,reportError}) {
 // Carrega comandas visíveis ao usuário autenticado.
 async function loadOrders(){
  const epoch=getEpoch();
  state.ordersStatus="loading";if(state.page==="Comandas"&&!state.selectedOrder)render();
  try{
   const rows=await fetchProfessionalOrders({client:supabase,organizationId:state.orgId,branchId:state.branchId});
   if(epoch===getEpoch()){state.orders=rows;state.ordersStatus="ready";}
  }catch(error){
   if(epoch===getEpoch()){state.ordersStatus="error";reportError(error,{context:"App Profissional > comandas"});}
   throw error;
  }
 }
 
 async function loadCommissions(){
  if(!state.professional?.id||state.commissionStatus==="loading")return;
  const epoch=getEpoch();
  state.commissionStatus="loading";
  if(state.page==="Comissões")render();
  try{
   const result=await fetchProfessionalCommissions({
    client:supabase,organizationId:state.orgId,professionalId:state.professional.id
   });
   if(epoch!==getEpoch())return;
   state.commissions=result.commissions;state.commissionPayouts=result.payouts;state.commissionStatus="ready";
  }catch(error){
   if(epoch!==getEpoch())return;
   state.commissions=[];state.commissionPayouts=[];state.commissionStatus="error";
   reportError(error,{context:"App Profissional > extrato de comissões"});
  }
  if(epoch===getEpoch()&&state.page==="Comissões")render();
 }
 async function loadOrderItems(){
  if(!state.selectedOrder)return;
  const epoch=getEpoch(),orderId=state.selectedOrder.id;
  const items=await fetchProfessionalOrderItems({
   client:supabase,organizationId:state.orgId,orderId
  });
  if(epoch!==getEpoch()||state.selectedOrder?.id!==orderId)return;
  state.orderItems=items;state.orderItemsStatus="ready";render();
 }
 async function chooseOrder(id){
  state.selectedOrder=state.orders.find(o=>o.id===id)||null;state.orderItems=[];state.orderItemsStatus="loading";render();
  const epoch=getEpoch();
  try{await loadOrderItems();}catch(error){if(epoch===getEpoch()&&state.selectedOrder?.id===id){state.orderItemsStatus="error";render();reportError(error,{context:"App Profissional > itens da comanda"});}}
 }
 return {loadOrders,loadCommissions,loadOrderItems,chooseOrder};
}
