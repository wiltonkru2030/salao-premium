/** Abre o modal de detalhes e mantém o ID selecionado separado das ações da lista. */
export function syncAppointmentDialog(root,state,render){
 const dialog=root.querySelector("#professional-appointment-dialog");
 if(!dialog||!state.selectedAppointment||dialog.open)return;
 const close=()=>{const id=state.selectedAppointment?.id;state.selectedAppointment=null;state.appointmentModalMode=null;render();if(id)[...root.querySelectorAll("[data-appointment]")].find(button=>button.dataset.appointment===id&&button.dataset.reschedule!=="true")?.focus();};
 dialog.addEventListener("cancel",event=>{event.preventDefault();close();});
 dialog.addEventListener("click",event=>{if(event.target===dialog)close();});
 dialog.showModal();
}
