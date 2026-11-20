/**
 * Serviço de catálogo de serviços do SALÃO PREMIUM.
 * Responsabilidade: listar, cadastrar, editar e inativar serviços por organização.
 * Segurança: todas as operações exigem org_id; RLS limita gravações a owner/admin.
 */
const PAGE_SIZE=250;

/** Converte erros PostgREST em mensagens pt-BR sem expor SQL. */
function mapServiceError(error) {
  if(error?.code==="23505")return new Error("Já existe um serviço com esses dados.");
  if(error?.code==="42501")return new Error("Seu perfil não tem permissão para alterar serviços.");
  if(["PGRST205","42P01"].includes(error?.code))return new Error("O catálogo de serviços ainda não está disponível no banco.");
  return new Error("Não foi possível concluir a operação de serviços.");
}

/** Valida conexão e organização antes de acessar o catálogo. */
function requireContext(client,orgId) {
  if(!client?.from)throw new TypeError("A conexão com o catálogo não está disponível.");
  if(typeof orgId!=="string"||!orgId.trim())throw new TypeError("A organização ativa não foi identificada.");
}

/** Valida UUID de filial antes de compor filtros PostgREST. */
function requireBranchId(branchId) {
  if(branchId&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(branchId)) {
    throw new TypeError("A unidade selecionada não é válida.");
  }
}

/**
 * Consulta todas as páginas de serviços do tenant.
 * @param {object} options Cliente Supabase e organização.
 * @returns {Promise<Array<object>>} Serviços ativos e inativos.
 */
export async function listServices({client,orgId,branchId=null}={}) {
  requireContext(client,orgId);
  requireBranchId(branchId);
  const rows=[];
  try {
    for(let offset=0;;offset+=PAGE_SIZE) {
      let query=client.from("services")
        .select("id,name,category,duration_minutes,price,description,active,branch_id")
        .eq("org_id",orgId);
      if(branchId)query=query.or("branch_id.eq."+branchId+",branch_id.is.null");
      const {data,error}=await query.order("name").range(offset,offset+PAGE_SIZE-1);
      if(error)throw error;
      const page=Array.isArray(data)?data:[];
      rows.push(...page);
      if(page.length<PAGE_SIZE)break;
    }
    return rows;
  } catch(error) { throw mapServiceError(error); }
}

/**
 * Cadastra ou atualiza serviço, preservando escopo do tenant.
 * @param {object} options Dados do serviço e identificador opcional para edição.
 * @returns {Promise<void>} Resolve após persistir o serviço.
 */
export async function saveService({
  client,orgId,branchId=null,serviceId=null,name,category=null,durationMinutes,price,description=null
}={}) {
  requireContext(client,orgId);
  requireBranchId(branchId);
  const cleanName=String(name??"").trim();
  const duration=Number(durationMinutes),amount=Number(price);
  if(cleanName.length<2||cleanName.length>120)throw new TypeError("Informe um nome de serviço entre 2 e 120 caracteres.");
  if(!Number.isInteger(duration)||duration<5||duration>720||duration%5!==0)throw new TypeError("A duração deve ser múltipla de 5, entre 5 e 720 minutos.");
  if(!Number.isFinite(amount)||amount<0)throw new TypeError("Informe um preço válido.");
  const payload={
    name:cleanName,category:String(category??"").trim()||null,
    duration_minutes:duration,price:amount,
    description:String(description??"").trim()||null
  };
  try {
    const result=serviceId
      ? await client.from("services").update(payload).eq("org_id",orgId).eq("id",serviceId)
      : await client.from("services").insert({org_id:orgId,branch_id:branchId||null,...payload,active:true});
    if(result.error)throw result.error;
  } catch(error) { throw mapServiceError(error); }
}

/**
 * Ativa ou inativa serviço sem apagar o histórico de agendamentos/comandas.
 * @param {object} options Cliente, organização, serviço e estado desejado.
 * @returns {Promise<void>} Resolve após atualizar o estado.
 */
export async function setServiceActive({client,orgId,serviceId,active}={}) {
  requireContext(client,orgId);
  if(!serviceId||typeof active!=="boolean")throw new TypeError("Selecione um serviço e um estado válidos.");
  try {
    const {error}=await client.from("services").update({active}).eq("org_id",orgId).eq("id",serviceId);
    if(error)throw error;
  } catch(error) { throw mapServiceError(error); }
}
