/** Contrato de edição de comandas: valida dados locais; servidor decide autorização. */
import {parseServicePrice} from "./services.service.js";
/** Permissão visual, sem substituir a validação de pagamentos no servidor. */
export function canManageOrder(state,order=state.selectedOrder){
 return state.role==="professional"&&state.scope==="self"&&state.professional?.can_edit_own_orders===true&&
 !!order?.branch_id&&order.assigned_professional_id===state.professional.id&&["open","in_progress"].includes(order.status);
}
/** Quantidade inteira e desconto em moeda brasileira, mantendo o preço registrado. */
export function orderItemEditPayload(item,quantity,discount){
 const q=Number(quantity),d=parseServicePrice(discount);
 if(!item?.id||!Number.isInteger(q)||q<1||q>999)throw new Error("Informe uma quantidade de 1 a 999.");
 if(item.source_appointment_id&&q!==Number(item.quantity))throw new Error("A quantidade do serviço agendado deve ser mantida.");
 if(!Number.isFinite(Number(item.unit_price))||Math.round(d*100)>q*Math.round(Number(item.unit_price)*100))throw new Error("Desconto maior que o valor do item.");
 return {id:item.id,quantity:q,discount:d};
}
/** Executa operações autorizadas e converte falhas para mensagens seguras. */
export async function professionalOrderAction({client,organizationId,order,operation,payload={}}){
 if(!client?.rpc||!organizationId||!order?.id||!order.branch_id||!["products","service","product","edit","remove","cancel"].includes(operation))throw new Error("Operação de comanda inválida.");
 const {data,error}=await client.rpc("professional_order_action",{target_org:organizationId,unit:order.branch_id,order_key:order.id,operation,payload});
 if(error?.code==="42501")throw new Error("Você não tem permissão para alterar esta comanda.");
 if(error?.code==="23514")throw new Error("Operação bloqueada. Confira pagamentos, estoque ou vínculo com o atendimento.");
 if(error?.code==="22023")throw new Error("Confira os dados informados.");
 if(error)throw new Error("Não foi possível concluir a operação. Confira os itens antes de tentar novamente.");
 if(operation==="products"){if(!Array.isArray(data))throw new Error("Não foi possível carregar os produtos.");return data;}
 if(data?.id!==order.id)throw new Error("Não foi possível confirmar a alteração da comanda.");
 return data;
}
