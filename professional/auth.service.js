/** Autenticação profissional por CPF ou e-mail. Não manipula interface nem guarda credenciais. */
/** Valida entrada, autentica e retorna usuário confirmado pelo servidor. */
export async function authenticateProfessional({client,login,password}){
 if(!client?.auth||typeof login!=="string"||!login.trim()||typeof password!=="string"||!password)throw new Error("Informe seu CPF ou e-mail e sua senha.");
 login=login.trim();
  if(login.includes("@")){
   const {error}=await client.auth.signInWithPassword({email:login.toLowerCase(),password});
   if(error)throw new Error("E-mail ou senha inválidos.");
  }else{
   const {data,error}=await client.functions.invoke("professional-cpf-login",{body:{cpf:login.replace(/\D/g,""),password}});
   if(error||!data?.access_token||!data?.refresh_token)throw new Error("CPF ou senha inválidos.");
   const {error:sessionError}=await client.auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token});
   if(sessionError)throw sessionError;
  }
  const {data:userData,error:userError}=await client.auth.getUser();
  if(userError||!userData?.user)throw new Error("Não foi possível iniciar sua sessão.");

 return userData.user;
}
