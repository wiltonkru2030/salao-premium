/** Serviço de preferências: valida entradas, não altera identidade de login nem dados financeiros. */
export function normalizeProfilePreferences({email,pixType,pixKey,photoUrl,notifyAgenda,notifyCommissions}){
 const contact=String(email||"").trim(),type=String(pixType||""),key=String(pixKey||"").trim(),photo=String(photoUrl||"").trim();
 const emailValid=value=>value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
 if(contact&&!emailValid(contact))throw new Error("Informe um e-mail de contato válido.");
 if(Boolean(type)!==Boolean(key))throw new Error("Informe o tipo e a chave Pix ou deixe ambos vazios.");
 let normalized=key;
 if(["cpf","cnpj","phone"].includes(type)){
  if(!/^[0-9.()\s+/-]+$/.test(key))throw new Error("Confira o formato da chave Pix.");
  normalized=key.replace(/\D/g,"");
 }
 if(type==="phone"&&key.startsWith("+")&&!/^55\d{10,11}$/.test(normalized))throw new Error("Informe uma chave Pix de telefone brasileiro com DDD.");
 if(type==="phone"&&/^\d{10,11}$/.test(normalized))normalized="55"+normalized;
 const valid={cpf:/^\d{11}$/,cnpj:/^\d{14}$/,phone:/^55\d{10,11}$/,random:/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i};
 if(type&&!(type==="email"?emailValid(normalized):valid[type]?.test(normalized)))throw new Error("Confira o formato da chave Pix.");
 if(photo){
  try{
   const url=new URL(photo);
   if(url.protocol!=="https:"||url.username||url.password||photo.length>2048||!/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?\/[^\s]*$/.test(photo))throw Error();
  }catch{throw new Error("Informe um endereço HTTPS válido para a foto.");}
 }
 return {contact_email:contact||null,new_pix_type:type||null,new_pix_key:normalized||null,new_photo_url:photo||null,agenda_enabled:notifyAgenda===true,commissions_enabled:notifyCommissions===true};
}
/** Retorna somente as preferências vinculadas à sessão e organização ativa. */
export async function fetchProfilePreferences({client,organizationId}){
 const {data,error}=await client.rpc("get_professional_app_preferences",{target_org:organizationId});
 if(error||!data||typeof data!=="object")throw new Error("Não foi possível carregar seu perfil.");
 return data;
}
/** Persiste preferências; nunca propaga mensagens brutas ou registra dados Pix. */
export async function saveProfilePreferences({client,organizationId,...values}){
 const payload=normalizeProfilePreferences(values);
 const {data,error}=await client.rpc("save_professional_app_preferences",{target_org:organizationId,...payload});
 if(error?.code==="42501")throw new Error("Perfil não autorizado.");
 if(error?.code==="22023")throw new Error("Confira os dados de contato e as preferências.");
 if(error||!data)throw new Error("Não foi possível salvar as preferências. Tente novamente.");
 return data;
}
