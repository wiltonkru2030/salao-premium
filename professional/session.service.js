/** Consulta identidade e escopos autorizados. Sem DOM, armazenamento ou dependência de sessão global. */
import {resolveProfessionalContexts} from "./access.rules.js";
/** Cria mensagem segura; não expõe token, CPF ou dados do provedor. */
export class ProfessionalSessionError extends Error {
 constructor(code,message){super(message);this.name="ProfessionalSessionError";this.code=code;}
}
/** Obtém usuário confirmado pelo Auth; falhas temporárias não significam sessão expirada. */
export async function verifyProfessionalSession(client){
 let result;
 try{result=await client.auth.getUser();}catch{throw new ProfessionalSessionError("CONNECTION","Não foi possível verificar sua sessão. Confira a conexão.");}
 const {data,error}=result;
 if(error){
  if(error.name==="AuthSessionMissingError"||[401,403].includes(error.status)||["session_not_found","refresh_token_not_found","bad_jwt","user_not_found"].includes(error.code))throw new ProfessionalSessionError("EXPIRED","Sua sessão terminou. Entre novamente.");
  throw new ProfessionalSessionError("CONNECTION","Não foi possível verificar sua sessão. Confira a conexão.");
 }
 if(!data?.user)throw new ProfessionalSessionError("EXPIRED","Sua sessão terminou. Entre novamente.");
 return data.user;
}
/** Lista vínculos administrativos e profissionais; somente perfis ativos habilitam acesso. */
export async function fetchProfessionalContexts(client,userId){
 if(!userId)throw new ProfessionalSessionError("EXPIRED","Sua sessão terminou. Entre novamente.");
 const [members,profiles]=await Promise.all([
  client.from("org_memberships").select("org_id,role,status,professional_app_enabled,professional_app_scope").eq("user_id",userId).eq("status","active"),
  client.from("professionals").select("id,name,phone,email,specialty,profile_id,org_id,branch_id,active,access_enabled,can_edit_own_orders").eq("profile_id",userId)
 ]);
 if(members.error||profiles.error)throw new ProfessionalSessionError("CONNECTION","Não foi possível consultar as permissões da conta. Tente novamente.");
 const memberships=members.data||[],professionalRows=profiles.data||[];
 const contexts=resolveProfessionalContexts(memberships,professionalRows);
 if(!contexts.length){
  if(professionalRows.some(p=>memberships.some(m=>m.org_id===p.org_id&&m.role==="professional")&&(!p.active||!p.access_enabled)))throw new ProfessionalSessionError("DISABLED","Seu acesso profissional está desativado. Solicite a liberação ao salão.");
  throw new ProfessionalSessionError("NO_CONTEXT","Nenhum vínculo ativo autorizado. Entre em contato com o salão.");
 }
 return contexts;
}
/** Detecta mudança que exige descartar dados previamente carregados. */
export function sameProfessionalScope(previous,next){
 return !!next&&previous.orgId===next.orgId&&previous.role===next.role&&previous.scope===next.scope&&
 (previous.professional?.id||null)===(next.professional?.id||null)&&
 (previous.professional?.branch_id||null)===(next.professional?.branch_id||null)&&
 previous.professional?.can_edit_own_orders===next.professional?.can_edit_own_orders;
}
