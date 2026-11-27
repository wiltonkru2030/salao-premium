/** Dados totalmente fictícios para validar a apresentação real das views; sem Auth ou banco. */
import {createProfessionalState} from "../../professional/workspace-state.js";
import {createAgendaWorkspaceViews} from "../../professional/views/agenda-workspace.views.js";
import {renderProfessionalLoginView} from "../../professional/views/auth.views.js";
import {renderProfessionalShell,setProfessionalMenuOpen} from "../../professional/views/shell.views.js";
import {renderProfessionalCustomers} from "../../professional/views/customers.views.js";
import {renderProfessionalServices} from "../../professional/views/services.views.js";
import {ordersView,commissionsView,profileView,settingsView} from "../../professional/views/workspace.views.js";
import {renderNotificationsView} from "../../professional/views/notifications.views.js";
import {installGlobalMasks} from "../../src/utils/input-masks.js";
import {syncAppointmentDialog} from "../../professional/appointment-dialog.js";
import {handleAgendaClick} from "../../professional/agenda.controller.js";
import {bindProfessionalBookingSearch} from "../../professional/booking-search.js";
import {updatePixField} from "../../professional/utils/pix-fields.js";
const root=document.querySelector("#professional-app");
const pages=["Agenda","Clientes","Serviços","Comandas","Comissões","Notificações","Perfil","Configurações"];
const service={id:"s",name:"Hidratação capilar e finalização",category:"Tratamento",price:120,duration_minutes:60,linked:true,editable:true};
const customer={id:"c",name:"Cliente Fictícia de Nome Comprido para Teste",phone:"67999991234",branch_id:"b"};
const appointment={id:"a",professional_id:"p",branch_id:"b",customer_id:"c",customer_name:customer.name,customer_phone:customer.phone,professional_name:"Profissional QA",service_name:service.name,starts_at:"2026-11-26T14:00:00Z",ends_at:"2026-11-26T15:00:00Z",status:"confirmed",booking_source:"salon",price:120};
const order={id:"o",branch_id:"b",assigned_professional_id:"p",order_number:"QA-0001",status:"open",total:120};
const state=Object.assign(createProfessionalState(new Date(2026,10,26,12)),{
 user:{id:"u"},orgId:"org",role:"professional",scope:"self",branchId:"b",branches:[{id:"b",name:"Matriz"}],organization:{name:"Salão de demonstração",timezone:"America/Campo_Grande"},professional:{id:"p",name:"Profissional QA",branch_id:"b",can_edit_own_orders:true},
 appointments:[appointment],agendaStatus:"ready",customers:[customer],customersStatus:"ready",customerHistoryStatus:"ready",
 services:[service],serviceCatalog:[service],serviceCatalogStatus:"ready",orders:[order],ordersStatus:"ready",orderItemsStatus:"ready",
 orderItems:[{id:"item",professional_id:"p",item_type:"service",description:service.name,quantity:1,unit_price:120,discount:0,total:120}],
 commissionStatus:"ready",commissions:[{id:"com",amount:60,base_amount:120,rate:50,status:"pending",item_type:"service",created_at:appointment.starts_at,service_order_items:{description:service.name}}],
 commissionPayouts:[],notificationsStatus:"ready",notificationsUnread:1,notifications:[{id:"n",title:"Novo agendamento",body:"Consulte sua Agenda para verificar os detalhes.",created_at:appointment.starts_at,read_at:null}],
 profilePreferencesStatus:"ready",profilePreferences:{email:"qa@example.invalid",pix_type:"cpf",pix_key:"52998224725",notify_agenda:true,notify_commissions:false}
});
const {agendaView}=createAgendaWorkspaceViews({state,attendanceEnabled:true,appointmentStatusEnabled:true,rescheduleEnabled:true,bookingEnabled:true,unitBookingEnabled:true,customerRegistrationEnabled:true,workingHoursEnabled:true});
const renderers={Agenda:agendaView,Clientes:()=>renderProfessionalCustomers({...state,canManageCustomers:true}),"Serviços":()=>renderProfessionalServices(state.services,{manage:true,catalog:state.serviceCatalog,editor:state.serviceEditor,status:"ready"}),Comandas:()=>ordersView(state,{managementEnabled:true}),"Comissões":()=>commissionsView(state),"Notificações":()=>renderNotificationsView(state),Perfil:()=>profileView(state,{preferencesEnabled:true}),"Configurações":()=>settingsView(state,document.documentElement.dataset.theme,{preferencesEnabled:true})};
/** Monta o cenário solicitado, utilizando exatamente os renderizadores de produção. */
function show(scenario,theme){
 document.documentElement.dataset.theme=theme;
 state.selectedAppointment=scenario==="Atendimento"?appointment:null;state.appointmentModalMode="details";
 state.selectedOrder=scenario==="Itens da comanda"?order:null;
 state.customerEditor=scenario==="Cadastro de cliente"?{}:null;
 state.serviceEditor=scenario==="Cadastro de serviço"?{}:null;
 const parent={"Novo agendamento":"Agenda","Cadastro rápido":"Agenda",Atendimento:"Agenda","Itens da comanda":"Comandas","Cadastro de cliente":"Clientes","Cadastro de serviço":"Serviços"}[scenario]||scenario;
 state.page=parent;
 root.innerHTML=parent==="Login"?renderProfessionalLoginView("",theme):renderProfessionalShell({state,pages,content:renderers[parent]()});
 if(scenario==="Atendimento")syncAppointmentDialog(root,state,()=>show("Agenda",theme));
 if(["Novo agendamento","Cadastro rápido"].includes(scenario)){
  const dialog=root.querySelector("dialog");dialog.showModal();
  if(scenario==="Novo agendamento"){
   const mockClient={rpc:async(name)=>name==="list_own_professional_booking_slots"?{data:{reason:"available",slots:["13:00","13:05","14:30"]}}:{data:[customer]}};
   bindProfessionalBookingSearch(dialog.querySelector("#professional-new-appointment"),state,{client:mockClient});
  }
  if(scenario==="Cadastro rápido"){root.querySelector("#professional-new-appointment").hidden=true;root.querySelector("#professional-booking-quick-customer").hidden=false;}
 }
}
root.addEventListener("click",async event=>{const action=event.target.closest("[data-action]")?.dataset.action;if(action==="open-professional-menu"||action==="close-professional-menu"){setProfessionalMenuOpen(root,action==="open-professional-menu");return;}
 if(state.page==="Agenda")await handleAgendaClick({event,state,loadAppointments:async()=>{},render:()=>{const theme=document.documentElement.dataset.theme;root.innerHTML=renderProfessionalShell({state,pages,content:agendaView()});syncAppointmentDialog(root,state,()=>show("Agenda",theme));}});
});
root.addEventListener("change",event=>{if(event.target.matches("[name=pixType]"))updatePixField(event.target.form);});
installGlobalMasks();
window.professionalVisualFixture={show};
show("Agenda","light");
