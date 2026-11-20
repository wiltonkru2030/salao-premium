/** API de alteração de agendamentos próprios. O servidor valida identidade, horário e estado. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validate(client,id=null){
 if(typeof client?.rpc!=="function")throw new TypeError("A conexão com a Agenda não está disponível.");
 if(id!==null&&!UUID.test(String(id)))throw new TypeError("Agendamento inválido.");
}
function failure(error){
 const messages={"42501":"Esta alteração não está disponível para sua conta.","23P01":"O horário deixou de estar disponível. Consulte novamente.","40001":"O agendamento foi alterado. Atualize a lista.","22023":"Este atendimento não pode ser alterado pelo aplicativo. Entre em contato com o salão."};
 return new Error(messages[error?.code]||"Não foi possível concluir a alteração. Atualize a Agenda antes de tentar novamente.");
}
/** Lista permissões calculadas no banco. Em implantação parcial, mantém o histórico acessível. */
export async function fetchAppointmentChangeOptions({client}){
 validate(client);
 const {data,error}=await client.rpc("get_my_customer_appointment_change_options");
 if(["PGRST202","42883"].includes(error?.code))return [];
 if(error)throw failure(error);
 if(!Array.isArray(data))throw new Error("Não foi possível consultar as opções de alteração.");
 return data;
}
/** Consulta vagas na unidade, serviço e profissional originais, identificados pelo servidor. */
export async function fetchRescheduleSlots({client,appointmentId,date}){
 validate(client,appointmentId);
 if(!UUID.test(String(appointmentId))||typeof date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new TypeError("Informe uma data válida.");
 const parsed=new Date(date+"T00:00:00Z");
 if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)throw new TypeError("Informe uma data válida.");
 const {data,error}=await client.rpc("get_my_customer_reschedule_slots",{p_appointment_id:appointmentId,p_date:date});
 if(error)throw failure(error);
 if(!Array.isArray(data))throw new Error("Não foi possível consultar os horários.");
 return data;
}
/** Cancela ou muda o horário de um registro, enviando o início original para detectar concorrência. */
export async function changeCustomerAppointment({client,appointmentId,action,expectedStart,newStart=null}){
 validate(client,appointmentId);
 if(!UUID.test(String(appointmentId))||!["cancel","reschedule"].includes(action)||typeof expectedStart!=="string"||!Number.isFinite(Date.parse(expectedStart)))throw new TypeError("Selecione um agendamento válido.");
 if(action==="reschedule"&&(typeof newStart!=="string"||!Number.isFinite(Date.parse(newStart))||Date.parse(newStart)<=Date.now()))throw new TypeError("Selecione um novo horário futuro.");
 const {data,error}=await client.rpc("change_my_customer_appointment",{p_appointment_id:appointmentId,p_action:action,p_expected_start:new Date(expectedStart).toISOString(),p_new_start:action==="reschedule"?new Date(newStart).toISOString():null});
 if(error)throw failure(error);
 if(data!==appointmentId)throw new Error("Não foi possível verificar a alteração. Atualize a Agenda.");
 return data;
}
