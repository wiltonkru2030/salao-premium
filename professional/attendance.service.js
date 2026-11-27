/** Regras de apresentação e contrato do atendimento individual. O servidor repete toda autorização. */

/** Determina ações exibidas somente para o profissional e a unidade principal atribuídos. */
export function attendanceActions(state,appointment){
 if(!appointment||state.role!=="professional"||!state.professional?.branch_id||
 appointment.professional_id!==state.professional.id||appointment.branch_id!==state.professional.branch_id||
 appointment.appointment_group_id)return [];
 if(!appointment.service_order_id&&["scheduled","confirmed","arrived"].includes(appointment.status))return ["start"];
 if(appointment.service_order_id&&appointment.status==="in_progress")return ["order","finish"];
 if(appointment.service_order_id&&appointment.status==="completed")return ["order"];
 return [];
}

/** Apresenta botões com componentes globais, sem manipular DOM ou autorizar operações. */
export function renderAttendanceActions(state,appointment,enabled){
 if(!enabled)return "";
 const actions=attendanceActions(state,appointment);
 if(!actions.length)return "";
 const labels={start:"Iniciar atendimento",order:"Abrir comanda",finish:"Finalizar atendimento"};
 return '<div class="professional-card-actions">'+actions.map(action=>'<button type="button" class="btn '+(action==="order"?"secondary":"primary")+'" data-attendance-action="'+action+'">'+labels[action]+'</button>').join("")+'</div>';
}

/** Solicita transição atômica e valida o retorno antes de modificar estado local. */
export async function performAttendanceAction({client,organizationId,appointmentId,operation}){
 if(!client?.rpc||!organizationId||!appointmentId||!["start","finish"].includes(operation))throw new Error("Operação de atendimento inválida.");
 const {data,error}=await client.rpc("professional_attendance_action",{target_org:organizationId,target_appointment:appointmentId,operation});
 if(error?.code==="42501")throw new Error("Atendimento ou unidade não autorizados.");
 if(error?.code==="23514")throw new Error("O atendimento ou a comanda precisa ser conferido pela recepção.");
 const expected=operation==="start"?"in_progress":"completed";
 if(error||data?.id!==appointmentId||data.status!==expected||!data.order_id)throw new Error("Não foi possível atualizar o atendimento. Confira a Agenda e tente novamente.");
 return data;
}
