/**
 * Integração transacional Agenda–Comanda. Encapsula RPCs sem manipular a interface.
 */
const pending=new Set();
/**
 * Abre ou reutiliza uma comanda; evita solicitações simultâneas no mesmo cliente.
 * A idempotência entre dispositivos depende da transação no banco.
 * @param {object} input Cliente, organização, agendamento e preferência de comanda.
 * @returns {Promise<object>} Comanda retornada pela RPC.
 */
export async function startAgendaOrder({client,orgId,appointment,existingId=null,forceNew=false}){
 if(!client?.rpc||!orgId||!appointment?.id)throw new TypeError("Dados do atendimento inválidos.");
 const key=JSON.stringify([orgId,appointment.appointment_group_id||appointment.id]);
 if(pending.has(key))throw new Error("A abertura desta comanda já está em andamento.");
 pending.add(key);
 try{
  const rpc=appointment.appointment_group_id?"start_appointment_group_service_order":"start_appointment_service_order";
  const {data,error}=await client.rpc(rpc,{p_appointment_id:appointment.id,p_existing_order_id:existingId,p_force_new:!existingId&&forceNew});
  if(error)throw error;
  if(!data||data.order_number==null)throw new Error("Não foi possível confirmar a abertura da comanda. Atualize a agenda antes de tentar novamente.");
  return data;
 }finally{pending.delete(key);}
}
