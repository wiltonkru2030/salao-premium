/** Autenticação profissional por CPF ou e-mail. Não manipula interface nem guarda credenciais. */
import {verifyProfessionalSession,ProfessionalSessionError} from "./session.service.js";
/** Classifica falhas do provedor sem revelar a existência de CPF ou e-mail. */
export function loginFailure(error,fallback){
 const status=error?.context?.status??error?.status;
 if(status===429||error?.code==="over_request_rate_limit")return new ProfessionalSessionError("RATE_LIMIT","Muitas tentativas. Aguarde 15 minutos e tente novamente.");
 if(status>=500||error?.name==="FunctionsFetchError"||error?.name==="FunctionsRelayError"||error?.name==="AuthRetryableFetchError"||error instanceof TypeError)return new ProfessionalSessionError("CONNECTION","Não foi possível conectar ao serviço de autenticação. Tente novamente.");
 return new ProfessionalSessionError("INVALID_CREDENTIALS",fallback);
}
/** Valida entrada, autentica e retorna usuário confirmado pelo servidor. */
export async function authenticateProfessional({client,login,password}){
 if(!client?.auth||typeof login!=="string"||!login.trim()||typeof password!=="string"||!password)throw new ProfessionalSessionError("INVALID_INPUT","Informe seu CPF ou e-mail e sua senha.");
 login=login.trim();
 const fallback=login.includes("@")?"E-mail ou senha inválidos.":"CPF ou senha inválidos.";
 try{
  if(login.includes("@")){
   const {error}=await client.auth.signInWithPassword({email:login.toLowerCase(),password});
   if(error)throw loginFailure(error,fallback);
  }else{
   const cpf=login.replace(/\D/g,"");
   if(!/^\d{11}$/.test(cpf))throw new ProfessionalSessionError("INVALID_INPUT","Informe um CPF com 11 dígitos.");
   const {data,error}=await client.functions.invoke("professional-cpf-login",{body:{cpf,password}});
   if(error||!data?.access_token||!data?.refresh_token)throw loginFailure(error,fallback);
   const {error:sessionError}=await client.auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token});
   if(sessionError)throw loginFailure(sessionError,"Não foi possível iniciar sua sessão.");
  }
 }catch(error){
  if(error instanceof ProfessionalSessionError)throw error;
  throw loginFailure(error,fallback);
 }
 try{return await verifyProfessionalSession(client);}
 catch(error){
  // A autenticação pode ter persistido tokens antes de getUser falhar.
  // Não liberar acesso nem deixar uma sessão parcialmente confirmada como login bem-sucedido.
  if(error instanceof ProfessionalSessionError&&["EXPIRED","MISSING"].includes(error.code)){
   try{await client.auth.signOut({scope:"local"});}catch{/* a próxima inicialização revalida o servidor */}
  }
  throw error;
 }
}
