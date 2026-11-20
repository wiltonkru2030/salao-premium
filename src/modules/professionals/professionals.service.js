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
  if(error?.code==="42501")return new Error("Seu perfil não tem permissão para consultar todos os dados da equipe.");
  if(["PGRST205","42P01"].includes(error?.code))return new Error("Os dados da equipe ainda não estão disponíveis no banco.");
  return new Error("Não foi possível carregar os dados da equipe.");
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
