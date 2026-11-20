/** Consulta catálogo ativo e serviços habilitados para o profissional. Não altera estado de tela. */
/** Retorna serviços autorizados pelo vínculo e pelas políticas do banco. */
export async function fetchProfessionalServices({client,organizationId,professionalId}){
 if(!client?.from||!organizationId||!professionalId)throw new Error("Não foi possível identificar o profissional e o salão.");
 const {data:links,error:linkError}=await client.from("professional_services").select("service_id").eq("org_id",organizationId).eq("professional_id",professionalId);
 if(linkError)throw new Error("Não foi possível consultar os serviços autorizados.");
 const ids=[...new Set((links||[]).map(row=>row.service_id))];
 if(!ids.length)return [];
 const {data,error}=await client.from("services").select("id,name,category,duration_minutes,price").eq("org_id",organizationId).eq("active",true).order("name").limit(250).in("id",ids);
 if(error)throw new Error("Não foi possível carregar o catálogo de serviços.");
 return data||[];
}
