/**
 * Serviço de resolução do contexto de unidade ativa.
 * Responsabilidade: carregar filiais ativas e resolver a unidade permitida para o perfil.
 * Segurança: a consulta profissional usa profile_id autenticado; a leitura de filiais depende de RLS.
 */
import {listBranches} from "./branches.service.js";

/**
 * Resolve lista de unidades e filial selecionada para a sessão atual.
 * @param {object} options Cliente, organização, papel, usuário e filial anterior.
 * @returns {Promise<object>} Filiais ativas e filial selecionada, ou null se não houver vínculo.
 */
export async function resolveBranchContext({
  client,orgId,role,userId,previousBranchId=null
}={}) {
  if(!client?.from||typeof orgId!=="string"||!orgId.trim()) {
    throw new TypeError("A organização ativa não foi identificada.");
  }
  try {
    const branches=(await listBranches({client,orgId})).filter(branch=>branch.active);
    if(role==="professional") {
      const {data,error}=await client.from("professionals").select("branch_id")
        .eq("org_id",orgId).eq("profile_id",userId).maybeSingle();
      if(error)throw error;
      return {branches,branch:branches.find(item=>item.id===data?.branch_id)||null};
    }
    if(previousBranchId==="__all__") {
      return {branches,branch:{id:null,name:"Todas as unidades",isAll:true}};
    }
    const previous=branches.find(item=>item.id===previousBranchId);
    return {
      branches,
      branch:previous||branches.find(item=>item.is_main)||branches[0]||null
    };
  } catch(error) {
    throw new Error("Não foi possível identificar a unidade ativa da organização.");
  }
}
