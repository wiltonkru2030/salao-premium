/** Carteira e histórico de clientes autorizados. Consultas sem DOM; RLS permanece obrigatória. */
const PAGE_SIZE=200;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolve unidades ativas visíveis pelo usuário autenticado; falha fechada sem vínculo. */
async function allowedBranches(client,organizationId,professional){
 if(!client?.from||!UUID.test(organizationId||"")||!UUID.test(professional?.id||"")||professional.org_id!==organizationId)throw new Error("Não foi possível identificar o profissional e o salão.");
 let query=client.from("branches").select("id").eq("org_id",organizationId).eq("active",true);
 if(professional.branch_id)query=query.eq("id",professional.branch_id);
 const {data,error}=await query;
 if(error)throw new Error("Não foi possível consultar as unidades autorizadas.");
 return (data||[]).map(row=>row.id).filter(id=>UUID.test(id));
}

/** Lista clientes ativos de todas as datas, somente sob RLS e unidades autorizadas. */
export async function fetchProfessionalCustomers({client,organizationId,professional}){
 const branches=await allowedBranches(client,organizationId,professional);
 if(!branches.length)return [];
 const rows=[];
 for(let offset=0;;offset+=PAGE_SIZE){
  const {data,error}=await client.from("customers").select("id,name,phone,branch_id")
   .eq("org_id",organizationId).eq("active",true)
   .or("branch_id.is.null,branch_id.in.("+branches.join(",")+")")
   .order("name").order("id").range(offset,offset+PAGE_SIZE-1);
  if(error)throw new Error("Não foi possível carregar os clientes. Tente novamente.");
  rows.push(...(data||[]));
  if(!data||data.length<PAGE_SIZE)return rows;
 }
}

/** Retorna até 50 atendimentos próprios do cliente, nas unidades autorizadas. */
export async function fetchProfessionalCustomerHistory({client,organizationId,professional,customerId}){
 if(!UUID.test(customerId||""))throw new Error("Cliente inválido.");
 const branches=await allowedBranches(client,organizationId,professional);
 if(!branches.length)return [];
 const {data,error}=await client.from("appointments").select("id,starts_at,service_name,status,price")
  .eq("org_id",organizationId).eq("professional_id",professional.id).eq("customer_id",customerId)
  .in("branch_id",branches).order("starts_at",{ascending:false}).limit(50);
 if(error)throw new Error("Não foi possível carregar o histórico. Tente novamente.");
 return data||[];
}
