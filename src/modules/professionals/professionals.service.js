/**
 * Serviço de dados da equipe do SALÃO PREMIUM.
 * Responsabilidade: consultar profissionais, catálogo ativo, vínculos e perfis de acesso.
 * Segurança: cada consulta é limitada à organização; RLS decide os registros visíveis.
 */
function requireContext(client,orgId) {
  if(!client?.from)throw new TypeError("A conexão com a equipe não está disponível.");
  if(typeof orgId!=="string"||!orgId.trim())throw new TypeError("A organização ativa não foi identificada.");
}

/** Converte falhas de leitura em mensagem segura para a interface. */
function mapWorkspaceError(error) {
  if(error?.code==="42501")return new Error("Seu perfil não tem permissão para consultar ou alterar dados da equipe.");
  if(error?.code==="P0002"||error?.code==="PGRST116")return new Error("O profissional não foi encontrado ou não está mais disponível.");
  if(error?.code==="23505")return new Error("Já existe um cadastro profissional com esses dados.");
  if(error?.code==="23503")return new Error("Um serviço ou vínculo selecionado não está mais disponível.");
  if(error?.code==="22023")return new Error("Confira os dados do profissional e os serviços selecionados.");
  if(["PGRST202","PGRST205","42P01"].includes(error?.code))return new Error("O módulo de equipe ainda não está disponível no banco.");
  return new Error("Não foi possível concluir a operação da equipe.");
}

/**
 * Carrega os dados necessários à página de profissionais.
 * @param {object} options Cliente Supabase, organização e usuário atual.
 * @returns {Promise<object>} Profissionais, serviços, vínculos, membros e perfis.
 */
export async function fetchProfessionalWorkspace({client,orgId,currentUserId}={}) {
  requireContext(client,orgId);
  try {
    const [professionalResult,serviceResult,membersResult,assignmentResult]=await Promise.all([
      client.from("professionals")
        .select("id,name,phone,email,active,access_enabled,commission_rate,tax_regime,cnpj,legal_name,trade_name,specialty")
        .eq("org_id",orgId).order("name"),
      client.from("services").select("id,name,category,active")
        .eq("org_id",orgId).eq("active",true).order("category").order("name").limit(500),
      client.from("org_memberships").select("user_id,role,professional_app_enabled,professional_app_scope")
        .eq("org_id",orgId).eq("status","active").in("role",["owner","admin","receptionist"]),
      client.from("professional_services").select("professional_id,service_id").eq("org_id",orgId)
    ]);
    for(const result of [professionalResult,serviceResult,membersResult,assignmentResult]) {
      if(result.error)throw result.error;
    }
    const professionals=professionalResult.data||[];
    const services=serviceResult.data||[];
    const members=membersResult.data||[];
    const assignments=assignmentResult.data||[];
    const targets=members.filter(member=>member.role==="receptionist"||member.user_id===currentUserId);
    const targetIds=targets.map(member=>member.user_id);
    let profiles=[];
    if(targetIds.length) {
      const profileResult=await client.from("profiles").select("id,full_name").in("id",targetIds);
      if(profileResult.error)throw profileResult.error;
      profiles=profileResult.data||[];
    }
    return {professionals,services,members,assignments,profiles};
  } catch(error) { throw mapWorkspaceError(error); }
}


/**
 * Ativa ou inativa um profissional sem remover seus vínculos históricos.
 * @param {object} options Cliente Supabase, organização, profissional e estado desejado.
 * @returns {Promise<void>} Resolve quando o servidor confirma a alteração.
 */
export async function setProfessionalActive({client,orgId,professionalId,active}={}) {
  requireContext(client,orgId);
  if(!professionalId||typeof active!=="boolean")throw new TypeError("Selecione um profissional e uma situação válidos.");
  try {
    const {data,error}=await client.from("professionals").update({active})
      .eq("org_id",orgId).eq("id",professionalId).select("id").maybeSingle();
    if(error)throw error;
    if(!data?.id)throw Object.assign(new Error("Profissional não encontrado."),{code:"P0002"});
  } catch(error) { throw mapWorkspaceError(error); }
}


/**
 * Libera ou revoga o App Profissional para membro elegível da organização.
 * @param {object} options Cliente, organização, usuário, papel e estado desejado.
 * @returns {Promise<object>} Confirmação de acesso retornada pelo RPC.
 */
export async function setTeamProfessionalAppAccess({
  client,orgId,userId,role,enabled
}={}) {
  if(!client?.rpc)throw new TypeError("A conexão com os acessos não está disponível.");
  if(typeof orgId!=="string"||!orgId.trim()||!userId||typeof enabled!=="boolean") {
    throw new TypeError("Informe organização, usuário e situação válidos.");
  }
  if(!["owner","admin","receptionist"].includes(role)) {
    throw new TypeError("Este perfil não pode receber acesso por esta operação.");
  }
  try {
    const {data,error}=await client.rpc("set_professional_app_access",{
      p_org_id:orgId,p_target_user_id:userId,p_enabled:enabled,
      p_scope:role==="receptionist"?"calendar_all":"all"
    });
    if(error)throw error;
    if(!data||typeof data!=="object"||data.enabled!==enabled) {
      throw new Error("O servidor não confirmou a alteração de acesso.");
    }
    return data;
  } catch(error) { throw mapWorkspaceError(error); }
}

/**
 * Revoga o acesso do App Profissional vinculado ao cadastro de um profissional.
 * @param {object} options Cliente Supabase, organização e ID do profissional.
 * @returns {Promise<void>} Resolve após confirmação do RPC.
 */
export async function revokeProfessionalAppAccess({client,orgId,professionalId}={}) {
  if(!client?.rpc)throw new TypeError("A conexão com os acessos não está disponível.");
  if(typeof orgId!=="string"||!orgId.trim()||!professionalId) {
    throw new TypeError("Selecione uma organização e um profissional válidos.");
  }
  try {
    const {error}=await client.rpc("revoke_professional_app_access",{
      p_org_id:orgId,p_professional_id:professionalId
    });
    if(error)throw error;
  } catch(error) { throw mapWorkspaceError(error); }
}


/**
 * Cria profissional e vínculos de serviços em uma única transação no banco.
 * @param {object} options Cliente, organização, dados cadastrais e serviços selecionados.
 * @returns {Promise<string>} ID do profissional criado.
 */
export async function createProfessionalWithServices({
  client,orgId,name,phone=null,email=null,commissionRate,taxRegime="individual",
  cnpj=null,legalName=null,tradeName=null,specialty=null,serviceIds=[]
}={}) {
  if(!client?.rpc)throw new TypeError("A conexão com o cadastro profissional não está disponível.");
  const cleanName=String(name??"").trim();
  const rate=Number(commissionRate);
  const ids=Array.isArray(serviceIds)?serviceIds.filter(Boolean):[];
  if(typeof orgId!=="string"||!orgId.trim()||cleanName.length<2||cleanName.length>120) {
    throw new TypeError("Informe a organização e o nome do profissional.");
  }
  if(!Number.isFinite(rate)||rate<0||rate>100)throw new TypeError("A comissão deve estar entre 0 e 100 por cento.");
  if(!["individual","mei"].includes(taxRegime))throw new TypeError("Regime fiscal inválido.");
  if(taxRegime==="mei"&&(String(cnpj??"").replace(/\D/g,"").length!==14||String(legalName??"").trim().length<2)) {
    throw new TypeError("Para MEI, informe CNPJ e razão social válidos.");
  }
  if(!ids.length||new Set(ids).size!==ids.length)throw new TypeError("Selecione serviços válidos sem duplicidade.");
  try {
    const {data,error}=await client.rpc("create_professional_with_services",{
      p_org_id:orgId,p_name:cleanName,p_phone:phone,p_email:email,
      p_commission_rate:rate,p_tax_regime:taxRegime,
      p_cnpj:taxRegime==="mei"?String(cnpj).replace(/\D/g,""):null,
      p_legal_name:taxRegime==="mei"?String(legalName).trim():null,
      p_trade_name:taxRegime==="mei"?String(tradeName??"").trim()||null:null,
      p_specialty:String(specialty??"").trim()||null,p_service_ids:ids
    });
    if(error)throw error;
    if(typeof data!=="string"||!data)throw new Error("O servidor não confirmou o cadastro profissional.");
    return data;
  } catch(error) { throw mapWorkspaceError(error); }
}
