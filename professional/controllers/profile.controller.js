/** createProfileController — coordena estado e serviços; não possui sessão global. */
import {fetchProfilePreferences,saveProfilePreferences} from "../profile-preferences.service.js";

/** Recebe dependências e retorna operações do módulo. Respostas antigas são descartadas por geração de sessão. */
export function createProfileController({state,supabase,getEpoch,render,showNotice,profilePreferencesEnabled}) {
 /** Carrega preferências somente nas telas de perfil, descartando respostas de outras sessões. */
 async function loadProfilePreferences(){
  if(!profilePreferencesEnabled||state.role!=="professional"||state.profilePreferencesStatus==="loading")return;
  const epoch=getEpoch();
  state.profilePreferencesStatus="loading";
  if(["Perfil","Configurações"].includes(state.page))render();
  try{
   const data=await fetchProfilePreferences({client:supabase,organizationId:state.orgId});
   if(epoch!==getEpoch())return;
   state.profilePreferences=data;state.profilePreferencesStatus="ready";
  }catch{
   if(epoch!==getEpoch())return;
   state.profilePreferences=null;state.profilePreferencesStatus="error";
  }
  if(epoch===getEpoch()&&["Perfil","Configurações"].includes(state.page))render();
 }
 /** Salva apenas campos editáveis; erros não registram conteúdo da chave Pix. */
 async function submitProfilePreferences(form){
  if(!profilePreferencesEnabled||state.role!=="professional"||state.page!=="Configurações"||state.profilePreferencesStatus!=="ready")return;
  const button=form.querySelector("[type=submit]"),feedback=form.querySelector("[data-profile-preferences-error]");
  if(button.disabled)return;
  button.disabled=true;feedback.hidden=true;
  const epoch=getEpoch(),values=new FormData(form);
  try{
   const data=await saveProfilePreferences({client:supabase,organizationId:state.orgId,email:values.get("email"),pixType:values.get("pixType"),pixKey:values.get("pixKey"),photoUrl:values.get("photoUrl"),notifyAgenda:values.has("notifyAgenda"),notifyCommissions:values.has("notifyCommissions")});
   if(epoch!==getEpoch())return;
   state.profilePreferences=data;state.professional={...state.professional,email:data.email};
   if(["Perfil","Configurações"].includes(state.page))showNotice("Preferências salvas.");
  }catch(error){if(epoch===getEpoch()&&form.isConnected){feedback.textContent=error.message;feedback.hidden=false;}}
  finally{button.disabled=false;}
 }
 return {loadProfilePreferences,submitProfilePreferences};
}
