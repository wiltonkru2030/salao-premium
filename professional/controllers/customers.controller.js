import {canUseSelectedUnit,selectedUnitArgs} from "../unit-context.js";
/** createCustomersController — coordena estado e serviços; não possui sessão global. */
import {fetchProfessionalCustomers,fetchProfessionalCustomerHistory,listUnitCustomers,saveUnitCustomer} from "../customers.service.js";

/** Recebe dependências e retorna operações do módulo. Respostas antigas são descartadas por geração de sessão. */
export function createCustomersController({state,supabase,getEpoch,render,reportError,customerRegistrationEnabled}) {
 /** Carrega a carteira somente ao abrir Clientes; descarta respostas de sessões encerradas. */
 async function loadCustomers(){
  const epoch=getEpoch();
  state.customersStatus="loading";render();
  try {
   const options={client:supabase,organizationId:state.orgId,professional:state.professional,branchId:state.branchId};
   const rows=customerRegistrationEnabled&&canUseSelectedUnit(state)?await listUnitCustomers({...options,branchId:state.explicitBranchEnabled?state.branchId:null}):await fetchProfessionalCustomers(options);
   if(epoch!==getEpoch())return;
   state.customers=rows;state.customersStatus="ready";
  }catch(error){
   if(epoch!==getEpoch())return;
   state.customers=[];state.customersStatus="error";reportError(error,{context:"App Profissional > clientes"});
  }
  if(epoch===getEpoch()&&state.page==="Clientes")render();
 }
 /** Abre ficha autorizada e consulta os últimos atendimentos próprios, sem depender do mês. */
 async function openCustomer(id){
  const customer=state.customers.find(row=>row.id===id);
  if(!customer)return;
  const epoch=getEpoch();
  state.selectedCustomer=customer;state.customerHistory=[];state.customerHistoryStatus="loading";render();
  try {
   const rows=await fetchProfessionalCustomerHistory({client:supabase,organizationId:state.orgId,professional:state.professional,customerId:id,branchId:state.branchId});
   if(epoch!==getEpoch()||state.selectedCustomer?.id!==id)return;
   state.customerHistory=rows;state.customerHistoryStatus="ready";
  }catch(error){
   if(epoch!==getEpoch()||state.selectedCustomer?.id!==id)return;
   state.customerHistoryStatus="error";reportError(error,{context:"App Profissional > histórico do cliente"});
  }
  if(epoch===getEpoch()&&state.page==="Clientes"&&state.selectedCustomer?.id===id)render();
 }
 
 /** Persiste o cadastro pelo contrato restrito à unidade; mantém os campos em caso de erro. */
 async function submitProfessionalCustomer(form){
  if(!customerRegistrationEnabled||state.role!=="professional"||state.page!=="Clientes"||!state.customerEditor||!canUseSelectedUnit(state))return;
  const button=form.querySelector("button[type=submit]"),feedback=form.querySelector("[data-customer-save-error]");
  if(button.disabled)return;
  button.disabled=true;feedback.hidden=true;
  const epoch=getEpoch(),editor=state.customerEditor,values=new FormData(form);
  try {
   const saved=await saveUnitCustomer({client:supabase,organizationId:state.orgId,...selectedUnitArgs(state),customerId:editor.id||null,name:values.get("name"),phone:values.get("phone")});
   if(epoch!==getEpoch()||state.page!=="Clientes"||state.customerEditor!==editor)return;
   state.customerEditor=null;state.selectedCustomer=null;state.notice="Cadastro salvo.";
   await loadCustomers();
   if(epoch===getEpoch()&&state.page==="Clientes")await openCustomer(saved.id);
  }catch(error){
   if(epoch===getEpoch()&&form.isConnected){feedback.textContent=error.message;feedback.hidden=false;}
  }finally{button.disabled=false;}
 }
 return {loadCustomers,openCustomer,submitProfessionalCustomer};
}
