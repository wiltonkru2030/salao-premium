/** createNotificationsController — coordena estado e serviços; não possui sessão global. */
import {fetchProfessionalNotifications,markProfessionalNotificationsRead} from "../notifications.service.js";

/** Recebe dependências e retorna operações do módulo. Respostas antigas são descartadas por geração de sessão. */
export function createNotificationsController({state,supabase,getEpoch,render,showNotice,notificationsEnabled,updateUnread=()=>{}}) {
 /** Consulta a central e o contador; respostas de sessões anteriores são ignoradas. */
 async function loadNotifications(){
  if(!notificationsEnabled||state.role!=="professional"||state.notificationsStatus==="loading")return;
  const epoch=getEpoch(),onlyUnread=state.notificationsFilter;
  state.notificationsStatus="loading";
  if(state.page==="Notificações")render();
  try{
   const result=await fetchProfessionalNotifications({client:supabase,organizationId:state.orgId,onlyUnread});
   if(epoch!==getEpoch())return;
   state.notifications=result.items;state.notificationsUnread=result.unreadCount;state.notificationsStatus="ready";updateUnread(result.unreadCount);
  }catch{
   if(epoch!==getEpoch())return;
   state.notifications=[];state.notificationsStatus="error";
  }
  if(epoch===getEpoch()&&state.page==="Notificações")render();
 }
 /** Marca somente notificações da conta ativa; recarrega o extrato após confirmação. */
 async function readNotifications(control,id=null){
  if(!notificationsEnabled||state.role!=="professional"||state.page!=="Notificações"||state.notificationsStatus!=="ready"||control.disabled)return;
  if(id&&!state.notifications.some(item=>item.id===id))return;
  const epoch=getEpoch();
  control.disabled=true;
  try{
   await markProfessionalNotificationsRead({client:supabase,organizationId:state.orgId,notificationId:id});
   if(epoch!==getEpoch())return;
   await loadNotifications();
  }catch(error){if(epoch===getEpoch()&&state.page==="Notificações")showNotice(error.message);}
  finally{if(control.isConnected)control.disabled=false;}
 }
 return {loadNotifications,readNotifications};
}
