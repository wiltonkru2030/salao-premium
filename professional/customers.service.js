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

/** Consulta a carteira da unidade atribuída pelo servidor, sem ampliar políticas RLS. */
export async function listUnitCustomers({client,organizationId}){
 const rows=[];
 for(let offset=0;;offset+=PAGE_SIZE){
  const {data,error}=await client.rpc("list_professional_unit_customers",{target_org:organizationId,page_offset:offset});
  if(error||!Array.isArray(data))throw new Error("Não foi possível consultar a carteira da unidade.");
  rows.push(...data);
  if(data.length<PAGE_SIZE)return rows;
 }
}

/** Valida nome e WhatsApp; o servidor verifica unidade, vínculo e duplicidade. */
export async function saveUnitCustomer({client,organizationId,customerId=null,name,phone}){
 const cleanName=String(name||"").trim(),cleanPhone=String(phone||"").replace(/\D/g,"");
 if(cleanName.length<2||cleanName.length>120)throw new Error("Informe o nome entre 2 e 120 caracteres.");
 if(!/^\d{10,11}$/.test(cleanPhone))throw new Error("Informe o telefone com DDD.");
 const {data,error}=await client.rpc("save_professional_unit_customer",{target_org:organizationId,target_customer:customerId,customer_name:cleanName,customer_phone:cleanPhone});
 if(error?.code==="23505")throw new Error("Já existe um cadastro com este telefone. Consulte o salão.");
 if(error?.code==="42501")throw new Error("Você não tem autorização para este cadastro.");
 if(error||!data?.id)throw new Error("Não foi possível salvar o cadastro. Tente novamente.");
 return data;
}
