/**
 * Serviço de equipe e permissões do SALÃO PREMIUM.
 * Responsabilidade: consultar membros/perfis e administrar acesso da recepção ao App Profissional.
 * Segurança: escopo explícito org_id; RPC valida o operador e o usuário-alvo no banco.
 */
function requireContext(client,orgId) {
  if(!client?.from||!client?.rpc)throw new TypeError("A conexão com a equipe não está disponível.");
  if(typeof orgId!=="string"||!orgId.trim())throw new TypeError("A organização ativa não foi identificada.");
}

/** Converte erros técnicos em mensagens seguras em pt-BR. */
function mapTeamError(error) {
  if(error?.code==="42501")return new Error("Seu perfil não tem permissão para administrar os acessos da equipe.");
  if(["PGRST202","PGRST205","42P01"].includes(error?.code))return new Error("O módulo de equipe ainda não está disponível no banco.");
  return new Error("Não foi possível concluir a operação da equipe.");
}

/**
 * Carrega membros ativos/inativos e seus perfis da organização atual.
 * @param {object} options Cliente Supabase e organização.
 * @returns {Promise<object>} Lista de membros e mapa de perfis por usuário.
 */
export async function fetchTeamWorkspace({client,orgId}={}) {
  requireContext(client,orgId);
  try {
    const {data:members,error}=await client.from("org_memberships")
      .select("user_id,role,status,professional_app_enabled,professional_app_scope,created_at")
      .eq("org_id",orgId).order("created_at");
    if(error)throw error;
    const rows=Array.isArray(members)?members:[];
    const ids=[...new Set(rows.map(member=>member.user_id).filter(Boolean))];
    let profiles=[];
    if(ids.length) {
      const result=await client.from("profiles").select("id,full_name,phone").in("id",ids);
      if(result.error)throw result.error;
      profiles=result.data||[];
    }
    return {members:rows,profiles};
  } catch(error) { throw mapTeamError(error); }
}

/**
 * Altera o acesso da recepção ao App Profissional usando a RPC com organização explícita.
 * @param {object} options Cliente, organização, usuário-alvo e estado desejado.
 * @returns {Promise<object>} Confirmação de acesso retornada pelo banco.
 */
export async function setReceptionAppAccess({client,orgId,userId,enabled}={}) {
  requireContext(client,orgId);
  if(!userId||typeof enabled!=="boolean")throw new TypeError("Selecione um usuário e uma situação válida.");
  try {
    const {data,error}=await client.rpc("set_professional_app_access",{
      p_org_id:orgId,p_target_user_id:userId,p_enabled:enabled,p_scope:"calendar_all"
    });
    if(error)throw error;
    if(!data||typeof data!=="object"||data.enabled!==enabled)throw new Error("O servidor não confirmou a alteração de acesso.");
    return data;
  } catch(error) { throw mapTeamError(error); }
}

/**
 * Carrega unidades ativas e atribuições visíveis no salão da equipe.
 * @param {object} options Cliente Supabase e organização ativa.
 * @returns {Promise<object>} Unidades e vínculos permitidos pelas políticas do banco.
 */
export async function fetchTeamBranches({client, orgId}={}) {
  requireContext(client, orgId);
  try {
    const [branches, assignments] = await Promise.all([
      client.from("branches").select("id,name").eq("org_id", orgId).eq("active", true).order("name"),
      client.from("branch_memberships").select("branch_id,user_id").eq("org_id", orgId)
    ]);
    if (branches.error || assignments.error) throw branches.error || assignments.error;
    return {branches: branches.data || [], assignments: assignments.data || []};
  } catch (error) { throw mapTeamError(error); }
}

/**
 * Adiciona ou revoga uma unidade de um membro. A RLS autoriza a escrita e as
 * chaves compostas vinculam membro e unidade ao mesmo salão.
 * @param {object} options Cliente, organização, unidade, usuário e estado desejado.
 * @returns {Promise<void>} Resolve quando o banco confirma a operação.
 */
export async function setTeamBranchAssignment({client, orgId, branchId, userId, assigned}={}) {
  requireContext(client, orgId);
  if (!branchId || !userId || typeof assigned !== "boolean") {
    throw new TypeError("Selecione uma unidade e um membro válidos.");
  }
  try {
    const table = client.from("branch_memberships");
    const result = await (assigned
      ? table.upsert({org_id: orgId, branch_id: branchId, user_id: userId}, {
          onConflict: "org_id,branch_id,user_id", ignoreDuplicates: true
        })
      : table.delete().eq("org_id", orgId).eq("branch_id", branchId).eq("user_id", userId)
          .select("branch_id"));
    if (result.error) throw result.error;
    if (!assigned && !result.data?.length) throw {code: "42501"};
  } catch (error) { throw mapTeamError(error); }
}
