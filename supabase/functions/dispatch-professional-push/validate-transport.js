/** Verifica autorização do projeto FCM sem entregar mensagens, sem consultar dispositivos.
 * Retorna somente resultado e status HTTP; nunca registra bearer, resposta ou credencial.
 * O destino fictício é fixo e validate_only é obrigatório.
 */
export async function validateFirebaseTransport({projectId,bearer,fetchImpl=fetch}){
 if(typeof projectId!=="string"||!/^[a-z0-9-]{4,64}$/.test(projectId)||typeof bearer!=="string"||!bearer)throw new Error("Configuração inválida.");
 const response=await fetchImpl("https://fcm.googleapis.com/v1/projects/"+projectId+"/messages:send",{
  method:"POST",headers:{Authorization:"Bearer "+bearer,"Content-Type":"application/json"},
  body:JSON.stringify({validate_only:true,message:{topic:"salao-premium-qa-validation-only",data:{kind:"professional_update"},webpush:{headers:{TTL:"300",Urgency:"normal"}}}}),
  signal:AbortSignal.timeout(10000)
 });
 return {validated:response.ok,httpStatus:response.status};
}
