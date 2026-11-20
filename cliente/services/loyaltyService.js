/**
 * Indicadores de fidelidade da identidade global.
 * Consulta apenas vínculos autenticados; nenhum ponto ou prêmio é fabricado.
 */
export async function getMyLoyaltyOverview({client,expectedUserId}={}){
 if(!client?.rpc||!client?.auth?.getUser)throw new TypeError("A conexão com a conta não está disponível.");
 if(!expectedUserId)throw new TypeError("A identidade da cliente não foi identificada.");
 const {data:user,error:authError}=await client.auth.getUser();
 if(authError||user?.user?.id!==expectedUserId)throw new Error("Sua sessão mudou. Entre novamente na conta.");
 const {data,error}=await client.rpc("get_my_customer_loyalty_overview");
 if(error){
  if(error.code==="42501")throw new Error("Você não tem permissão para consultar estes dados.");
  if(["PGRST202","42883"].includes(error.code))throw new Error("O histórico de fidelidade ainda não está disponível no banco.");
  throw new Error("Não foi possível consultar seu histórico de fidelidade.");
 }
 if(!Array.isArray(data))throw new Error("O histórico de fidelidade retornou dados inválidos.");
 const {data:after,error:afterError}=await client.auth.getUser();
 if(afterError||after?.user?.id!==expectedUserId)throw new Error("A sessão mudou durante a consulta.");
 return data.map(row=>{
  const completed=Number(row.completed_appointments),orders=Number(row.paid_orders),paid=Number(row.total_paid);
  if(!Number.isSafeInteger(completed)||completed<0||!Number.isSafeInteger(orders)||orders<0||
    !Number.isFinite(paid)||paid<0||!row.org_id)
   throw new Error("Os valores de fidelidade precisam de conferência.");
  return {orgId:row.org_id,salonName:String(row.salon_name||"Salão"),
   completedAppointments:completed,paidOrders:orders,totalPaid:paid,lastPaidAt:row.last_paid_at||null};
 });
}
