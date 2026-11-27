/** Navegação e carregamento sob demanda dos módulos; não altera autenticação. */
import {allowedProfessionalPages} from "../access.rules.js";
/** Controla seleção e recarregamento; ignora resultados de outra sessão ou página. */
export function createNavigationController({state,root,getEpoch,render,showNotice,loadOrders,loadServices,loadServiceCatalog,canManageServices,loadCustomers,loadCommissions,loadNotifications,loadProfilePreferences,profilePreferencesEnabled}){
 async function refreshOrders(){
  const epoch=getEpoch();
  try{
   const results=await Promise.allSettled([loadOrders(),...(state.role==="professional"?[loadServices()]:[])]);
   if(results.some(result=>result.status==="rejected"))throw new Error("Consulta incompleta.");
  }catch{
   if(epoch===getEpoch()&&state.page==="Comandas")showNotice("Não foi possível carregar todas as informações. Atualize as comandas para tentar novamente.");
  }
  if(epoch===getEpoch()&&state.page==="Comandas")render();
 }
 /** Abre apenas página autorizada, consulta seu módulo e preserva a geração da sessão. */
 async function navigate(page){
  if(!allowedProfessionalPages(state).includes(page))return;
  const epoch=getEpoch(),menuWasOpen=root.querySelector(".app-shell.is-menu-open");
  Object.assign(state,{page,selectedOrder:null,selectedAppointment:null,selectedCustomer:null,customerEditor:null,serviceEditor:null,customerHistory:[],notice:""});
  render();if(menuWasOpen)root.querySelector("[data-action=open-professional-menu]")?.focus();
  try{
   if(["Perfil","Configurações"].includes(page)&&profilePreferencesEnabled&&state.profilePreferencesStatus!=="ready")await loadProfilePreferences();
   if(page==="Notificações")await loadNotifications();
   if(page==="Comissões"){state.selectedPayout=null;await loadCommissions();}
   if(page==="Clientes")await loadCustomers();
   if(page==="Comandas")await refreshOrders();
   if(page==="Serviços"){if(canManageServices())await loadServiceCatalog();else await loadServices();}
  }catch{if(epoch===getEpoch()&&state.page===page)showNotice("Não foi possível carregar esta página. Tente novamente.");}
  if(epoch===getEpoch()&&state.page===page&&page==="Serviços")render();
 }
 return {navigate,refreshOrders};
}
