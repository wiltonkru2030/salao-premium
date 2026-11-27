import {unitRpc} from "./unit-context.js";
/** Consulta catálogo ativo e serviços habilitados para o profissional. Não altera estado de tela. */
/** Retorna serviços autorizados pelo vínculo e pelas políticas do banco. */
export async function fetchProfessionalServices({client,organizationId,professionalId,branchId=null}){
 if(!client?.from||!organizationId||!professionalId)throw new Error("Não foi possível identificar o profissional e o salão.");
 const {data:links,error:linkError}=await client.from("professional_services").select("service_id").eq("org_id",organizationId).eq("professional_id",professionalId);
 if(linkError)throw new Error("Não foi possível consultar os serviços autorizados.");
 const ids=[...new Set((links||[]).map(row=>row.service_id))];
 if(!ids.length)return [];
 let query=client.from("services").select("id,name,category,duration_minutes,price").eq("org_id",organizationId).eq("active",true).order("name").limit(250).in("id",ids);
 if(branchId){unitRpc("validate",{},branchId);query=query.or("branch_id.is.null,branch_id.eq."+branchId);}
 const {data,error}=await query;
 if(error)throw new Error("Não foi possível carregar o catálogo de serviços.");
 return data||[];
}

/** Lista catálogo ativo da unidade, com vínculo próprio e autorização de edição. */
export async function listUnitServices({client,organizationId,branchId=null}){
 const rows=[];
 for(let offset=0;;offset+=200){
  const rpc=unitRpc("list_professional_unit_services",{target_org:organizationId,page_offset:offset},branchId);
  const {data,error}=await client.rpc(rpc.name,rpc.args);
  if(error||!Array.isArray(data))throw new Error("Não foi possível carregar o catálogo da unidade.");
  rows.push(...data);if(data.length<200)return rows;
 }
}
/** Valida moeda brasileira em centavos sem aceitar texto arbitrário. */
export function parseServicePrice(value){
 const text=String(value??"").trim().replace(/^R\$\s*/,"");
 if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{2}$/.test(text))throw new Error("Informe o valor em reais e centavos.");
 const cents=Number(text.replace(/\D/g,""));
 if(!Number.isSafeInteger(cents)||cents>99999999)throw new Error("Valor do serviço inválido.");
 return cents/100;
}
/** Persiste serviço criado pelo profissional; a autorização de edição é conferida no banco. */
export async function saveUnitService({client,organizationId,serviceId=null,name,category,minutes,price,branchId=null}){
 const cleanName=String(name??"").trim(),cleanCategory=String(category??"").trim(),duration=Number(minutes);
 if(cleanName.length<2||cleanName.length>120||cleanCategory.length>100)throw new Error("Confira o nome e a categoria.");
 if(!Number.isInteger(duration)||duration<1||duration>1440)throw new Error("Informe uma duração de 1 a 1440 minutos.");
 const rpc=unitRpc("save_professional_unit_service",{target_org:organizationId,target_service:serviceId,service_name:cleanName,service_category:cleanCategory,service_minutes:duration,service_price:parseServicePrice(price)},branchId);
 const {data,error}=await client.rpc(rpc.name,rpc.args);
 if(error?.code==="23505")throw new Error("Já existe um serviço com esse nome. Procure no catálogo.");
 if(error?.code==="42501")throw new Error("Você não pode editar este serviço.");
 if(error||!data)throw new Error("Não foi possível salvar o serviço.");
 return data;
}
/** Vincula ou remove vínculo próprio sem excluir o registro do catálogo. */
export async function setUnitServiceLink({client,organizationId,serviceId,linked,branchId=null}){
 if(typeof linked!=="boolean")throw new Error("Vínculo inválido.");
 const rpc=unitRpc("set_professional_unit_service_link",{target_org:organizationId,target_service:serviceId,link_enabled:linked},branchId);
 const {data,error}=await client.rpc(rpc.name,rpc.args);
 if(error?.code==="23514")throw new Error("Há agendamentos ativos para este serviço.");
 if(error?.code==="42501")throw new Error("Serviço não autorizado nesta unidade.");
 if(error||data!==linked)throw new Error("Não foi possível alterar o vínculo.");
 return data;
}
