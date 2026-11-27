/** Contratos da central: dados retornados pelo vínculo autenticado no banco. */
/** Obtém as últimas 100 notificações e o contador global não lido. */
export async function fetchProfessionalNotifications({client,organizationId,onlyUnread=false}){
 if(!client?.rpc||!organizationId||typeof onlyUnread!=="boolean")throw new Error("Contexto de notificações inválido.");
 const {data,error}=await client.rpc("get_professional_notifications",{target_org:organizationId,only_unread:onlyUnread});
 if(error||!Array.isArray(data?.items)||!Number.isSafeInteger(Number(data.unread_count))||Number(data.unread_count)<0)throw new Error("Não foi possível carregar suas notificações.");
 return {items:data.items,unreadCount:Number(data.unread_count)};
}
/** Marca um aviso ou todos como lidos; não envia ID do profissional. */
export async function markProfessionalNotificationsRead({client,organizationId,notificationId=null}){
 if(!client?.rpc||!organizationId||(notificationId!==null&&typeof notificationId!=="string"))throw new Error("Notificação inválida.");
 const {data,error}=await client.rpc("mark_professional_notifications_read",{target_org:organizationId,target_notification:notificationId});
 if(error||data===null||!Number.isSafeInteger(Number(data))||Number(data)<0)throw new Error("Não foi possível marcar as notificações como lidas.");
 return Number(data);
}

/** Consulta um aviso individual autorizado, inclusive fora das 100 últimas notificações. */
export async function fetchProfessionalNotification({client,organizationId,notificationId}){
 if(!client?.rpc||!organizationId||typeof notificationId!=="string"||!notificationId)throw new Error("Notificação inválida.");
 const {data,error}=await client.rpc("get_professional_notification",{target_org:organizationId,target_notification:notificationId});
 if(error||data&&data.id!==notificationId)throw new Error("Não foi possível consultar este aviso.");
 return data||null;
}
