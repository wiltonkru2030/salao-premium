/** Preferência de push por aparelho e conta, sem persistir tokens ou dados de atendimento. */
const KEY="salao-premium:professional-push-consent-v1";
export function createPushConsent(storage){
 function read(){try{const value=JSON.parse(storage?.getItem(KEY)||"null");return typeof value?.userId==="string"&&typeof value?.orgId==="string"?value:null;}catch{return null;}}
 return {
  matches(userId,orgId){const row=read();return !!userId&&!!orgId&&row?.userId===userId&&row?.orgId===orgId;},
  save(userId,orgId){if(!userId||!orgId)return false;try{storage?.setItem(KEY,JSON.stringify({userId,orgId}));return !!storage;}catch{return false;}},
  clear(){try{storage?.removeItem(KEY);}catch{/* preferência indisponível */}}
 };
}
/** Somente títulos aprovados podem aparecer fora da sessão autenticada. */
const titles=new Set(["Cliente agendou","Cliente cancelou","Cliente confirmou","Cliente reagendou","Salão agendou","Salão cancelou","Salão confirmou","Salão reagendou","Profissional agendou","Profissional cancelou","Profissional confirmou","Profissional reagendou","Novo agendamento","Agendamento cancelado","Agendamento confirmado","Agendamento alterado","Agendamento transferido","Novo atendimento atribuído","Atendimento próximo","Pagamento de comissão registrado"]);
export function foregroundNotice(payload){
 const id=payload?.data?.notification_id;
 if(typeof id!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return null;
 return {title:titles.has(payload.data.title)?payload.data.title:"SALÃO PREMIUM",options:{body:"SALÃO PREMIUM · Abra o aplicativo para conferir os detalhes.",tag:"sp-professional-alert-"+id,icon:"/professional/notification-icon.webp",badge:"/professional/notification-badge.png",data:{notificationId:id}}};
}
