/** Coordena edição do expediente próprio; descarta respostas de outro contexto. */
import {loadOwnWorkingHours,saveOwnWorkingHours} from "../working-hours.service.js";
export function createWorkingHoursController({state,client,getEpoch,render,showNotice,enabled}){
 async function load(){
  if(!enabled||state.role!=="professional"||state.page!=="Configurações"||!state.professional?.id)return;
  const epoch=getEpoch();state.workingHoursStatus="loading";render();
  try{const rows=await loadOwnWorkingHours(client,state.orgId,state.professional.id);if(epoch!==getEpoch())return;state.workingHours=rows;state.workingHoursStatus="ready";}
  catch{if(epoch!==getEpoch())return;state.workingHoursStatus="error";}
  if(epoch===getEpoch()&&state.page==="Configurações")render();
 }
 async function save(form,remove=false){
  if(!enabled||state.page!=="Configurações"||state.role!=="professional"||state.workingHoursStatus!=="ready")return;
  const button=form.querySelector("[type=submit]"),feedback=form.querySelector("[data-hours-error]");
  if(button.disabled)return;
  if(remove&&!window.confirm("Excluir este horário do seu expediente?"))return;
  const epoch=getEpoch(),v=new FormData(form);button.disabled=true;feedback.hidden=true;
  try{await saveOwnWorkingHours(client,state.orgId,{id:form.dataset.id||null,weekday:Number(v.get("weekday")),startsAt:v.get("startsAt"),endsAt:v.get("endsAt"),remove});
   if(epoch===getEpoch()&&state.page==="Configurações"){await load();if(epoch===getEpoch()&&state.page==="Configurações")showNotice("Expediente atualizado.");}
  }catch(error){if(epoch===getEpoch()&&form.isConnected){feedback.textContent=error.message;feedback.hidden=false;}}
  finally{button.disabled=false;}
 }
 return {load,save};
}
