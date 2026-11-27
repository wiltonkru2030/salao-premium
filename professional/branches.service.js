/** Seleção de unidades visíveis pela RLS. Não modifica vínculo do profissional. */
import {ProfessionalSessionError} from "./session.service.js";
/** Consulta somente filiais ativas permitidas pelo servidor. */
export async function fetchProfessionalBranches({client,organizationId,professional}){
 if(!organizationId||!professional?.id||professional.org_id!==organizationId)throw new Error("Vínculo de unidade indisponível.");
 let query=client.from("branches").select("id,name,is_main").eq("org_id",organizationId).eq("active",true);
 if(professional.branch_id)query=query.eq("id",professional.branch_id);
 const {data,error}=await query.order("is_main",{ascending:false}).order("name").order("id");
 if(error||!Array.isArray(data))throw new ProfessionalSessionError("CONNECTION","Não foi possível consultar suas unidades. Confira a conexão e tente novamente.");
 if(!data.length)throw new ProfessionalSessionError("NO_CONTEXT","Nenhuma unidade ativa autorizada. Consulte o salão.");
 return data;
}
/** Unidade fixa entra diretamente; múltiplas unidades exigem seleção explícita. */
export function selectProfessionalBranch(branches,requested=null){
 if(requested)return branches.find(branch=>branch.id===requested)||null;
 return branches.length===1?branches[0]:null;
}
