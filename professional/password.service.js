/** Fluxo de senha provisória: marca administrativa tem precedência sobre preferência legada. */
/** Identifica o fluxo exigido sem usar a marca editável como autorização de servidor. */
export function requiresProfessionalPasswordChange(user){
 const meta=user?.app_metadata||{};
 if(meta.professional_password_generation||meta.professional_password_required===true)return meta.professional_password_required!==false;
 return user?.user_metadata?.must_change_password===true;
}
/** Encaminha senha atual e nova somente ao serviço autenticado; não registra credenciais. */
export async function completeProfessionalPasswordChange({client,currentPassword,password,confirm}){
 if(typeof currentPassword!=="string"||!currentPassword||currentPassword.length>128)throw new Error("Informe a senha temporária atual.");
 if(typeof password!=="string"||password.length<10||password.length>72||password!==confirm||password===currentPassword)throw new Error("Use uma senha diferente da temporária, de 10 a 72 caracteres, e confirme corretamente.");
 const {data,error}=await client.functions.invoke("complete-professional-password",{body:{current_password:currentPassword,new_password:password}});
 if(error||data?.success!==true)throw new Error("Não foi possível concluir a troca. Confira a senha temporária ou solicite nova senha ao salão.");
}
