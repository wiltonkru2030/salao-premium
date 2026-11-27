import {canUseSelectedUnit,selectedUnitArgs} from "../unit-context.js";
/** createServicesController — coordena estado e serviços; não possui sessão global. */
import {fetchProfessionalServices,listUnitServices,saveUnitService,setUnitServiceLink} from "../services.service.js";

/** Recebe dependências e retorna operações do módulo. Respostas antigas são descartadas por geração de sessão. */
export function createServicesController({state,supabase,getEpoch,render,reportError,showNotice,serviceManagementEnabled}) {
 /** Carrega o catálogo apenas para o contexto profissional atual. */
 async function loadServices(){
  const epoch=getEpoch();
  const rows=await fetchProfessionalServices({client:supabase,organizationId:state.orgId,professionalId:state.professional?.id,branchId:state.branchId});
  if(epoch===getEpoch())state.services=rows;
 }
 /** Habilita gerenciamento somente para a unidade atribuída e contrato homologado. */
 function canManageServices(){return serviceManagementEnabled&&canUseSelectedUnit(state);}
 /** Atualiza catálogo e serviços vinculados sem misturar sessões ou alterar o calendário. */
 async function loadServiceCatalog(){
  if(!canManageServices())return;
  const epoch=getEpoch();
  state.serviceCatalogStatus="loading";if(state.page==="Serviços")render();
  try{
   const rows=await listUnitServices({client:supabase,organizationId:state.orgId,...selectedUnitArgs(state)});
   if(epoch!==getEpoch())return;
   state.serviceCatalog=rows;state.services=rows.filter(row=>row.linked);state.serviceCatalogStatus="ready";
  }catch(error){
   if(epoch!==getEpoch())return;
   state.serviceCatalogStatus="error";reportError(error,{context:"App Profissional > catálogo"});
  }
  if(epoch===getEpoch()&&state.page==="Serviços")render();
 }
 /** Envia alteração de vínculo apenas uma vez e mantém a autorização no servidor. */
 async function changeServiceLink(button){
  if(!canManageServices()||state.page!=="Serviços"||button.disabled)return;
  const row=state.serviceCatalog.find(item=>item.id===button.dataset.serviceLink);
  if(!row)return;
  const linked=!row.linked;
  if(!linked&&!window.confirm("Remover este serviço dos seus vínculos? O cadastro do salão será preservado."))return;
  const epoch=getEpoch();button.disabled=true;
  try{
   await setUnitServiceLink({client:supabase,organizationId:state.orgId,...selectedUnitArgs(state),serviceId:row.id,linked});
   if(epoch!==getEpoch())return;
   state.notice=linked?"Serviço vinculado.":"Vínculo removido.";await loadServiceCatalog();
  }catch(error){if(epoch===getEpoch()&&state.page==="Serviços")showNotice(error.message);}
  finally{button.disabled=false;}
 }
 
 /** Valida formulário, evita envio repetido e atualiza serviços usados pela Agenda. */
 async function submitProfessionalService(form){
  if(!canManageServices()||state.page!=="Serviços"||!state.serviceEditor)return;
  const button=form.querySelector("[type=submit]"),feedback=form.querySelector("[data-service-save-error]");
  if(button.disabled)return;
  button.disabled=true;feedback.hidden=true;
  const epoch=getEpoch(),editor=state.serviceEditor,values=new FormData(form);
  try{
   await saveUnitService({client:supabase,organizationId:state.orgId,...selectedUnitArgs(state),serviceId:editor.id||null,name:values.get("name"),category:values.get("category"),minutes:values.get("minutes"),price:values.get("price")});
   if(epoch!==getEpoch()||state.page!=="Serviços"||state.serviceEditor!==editor)return;
   state.serviceEditor=null;state.notice="Serviço salvo.";await loadServiceCatalog();
  }catch(error){if(epoch===getEpoch()&&form.isConnected){feedback.textContent=error.message;feedback.hidden=false;}}
  finally{button.disabled=false;}
 }
 return {loadServices,canManageServices,loadServiceCatalog,changeServiceLink,submitProfessionalService};
}
