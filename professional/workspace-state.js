/** Estado inicial e descarte de dados privados. Sem DOM, rede ou armazenamento. */
/** Cria uma estrutura nova para cada sessão, inclusive listas, filtros e datas. */
export function createProfessionalState(now=new Date()){
 return {
  user:null,contextCount:0,branches:[],branchId:null,explicitBranchEnabled:false,orgId:null,role:null,scope:"none",professional:null,
  profile:null,profilePreferences:null,profilePreferencesStatus:"idle",organization:null,
  page:"Agenda",month:new Date(now.getFullYear(),now.getMonth(),1),selectedDate:new Date(now),selectedAppointment:null,appointments:[],agendaStatus:"idle",
  customers:[],customerHistory:[],selectedCustomer:null,customerEditor:null,customersStatus:"idle",customerHistoryStatus:"idle",
  orders:[],ordersStatus:"idle",selectedOrder:null,orderItems:[],orderItemsStatus:"idle",
  services:[],serviceCatalog:[],serviceEditor:null,serviceCatalogStatus:"idle",
  commissions:[],commissionPayouts:[],commissionStatus:"idle",commissionFilters:{from:"",to:"",status:"all",type:"all"},selectedPayout:null,
  pushStatus:"idle",notificationsEnabled:false,notifications:[],notificationsUnread:0,notificationsStatus:"idle",notificationsFilter:false,notice:""
 };
}
/** Limpa inclusive campos adicionados dinamicamente sem substituir a referência dos controladores. */
export function resetProfessionalState(state,now=new Date()){
 for(const key of Object.keys(state))delete state[key];
 return Object.assign(state,createProfessionalState(now));
}
