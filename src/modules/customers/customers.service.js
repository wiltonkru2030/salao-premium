/**
 * Serviço da carteira de clientes do SALÃO PREMIUM.
 * Responsabilidade: consultar, cadastrar, editar e inativar clientes por organização.
 * Escopo: registros locais de cada salão; identidade global da cliente é gerenciada por módulo próprio.
 * Segurança: toda consulta/mutação inclui org_id e depende das políticas RLS do Supabase.
 */
const PAGE_SIZE=250;

/** Traduz falhas do Supabase para mensagens seguras em pt-BR. */
function mapCustomerError(error) {
  if(error?.code==="23505")return new Error("Já existe um cadastro de cliente com esses dados.");
  if(error?.code==="42501")return new Error("Seu perfil não tem permissão para alterar este cadastro.");
  if(error?.code==="P0002"||error?.code==="PGRST116")return new Error("O cliente não foi encontrado ou não está mais disponível.");
  if(["PGRST205","42P01"].includes(error?.code))return new Error("A carteira de clientes não está disponível no banco.");
  return new Error("Não foi possível concluir a operação de clientes.");
}

/** Valida o cliente Supabase e o tenant antes de qualquer consulta. */
function requireContext(client,orgId) {
  if(!client?.from)throw new TypeError("A conexão com os clientes não está disponível.");
  if(typeof orgId!=="string"||!orgId.trim())throw new TypeError("A organização ativa não foi identificada.");
}

/** Valida o identificador de filial antes de compor filtros de consulta. */
function requireBranchId(branchId) {
  if(branchId&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(branchId)) {
    throw new TypeError("A unidade selecionada não é válida.");
  }
}

/** Normaliza e valida dados do cadastro local sem alterar identidade global. */
function normalizeCustomer(input={}) {
  const name=String(input.name??"").trim();
  const phone=String(input.phone??"").replace(/\s+/g," ").trim();
  const email=String(input.email??"").trim().toLowerCase();
  const birthDate=String(input.birthDate??"").trim();
  if(name.length<2||name.length>120)throw new TypeError("Informe o nome do cliente entre 2 e 120 caracteres.");
  if(phone.length>30)throw new TypeError("O telefone deve ter até 30 caracteres.");
  if(email.length>254||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))throw new TypeError("Informe um e-mail válido.");
  if(birthDate) {
    const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
    if(!match)throw new TypeError("Informe uma data de nascimento válida.");
    const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
    const leapYear=year%4===0&&(year%100!==0||year%400===0);
    const daysInMonth=[31,leapYear?29:28,31,30,31,30,31,31,30,31,30,31];
    if(year<1900||month<1||month>12||day<1||day>daysInMonth[month-1]||
       birthDate>new Date().toISOString().slice(0,10)) {
      throw new TypeError("Informe uma data de nascimento válida e não futura.");
    }
  }
  return {name,phone:phone||null,email:email||null,birth_date:birthDate||null};
}

/**
 * Lista todos os clientes do tenant com paginação, sem limite arbitrário de 500.
 * @param {object} options Cliente Supabase e ID da organização.
 * @returns {Promise<Array<object>>} Clientes ativos e inativos.
 */
export async function listCustomers({client,orgId,branchId=null}={}) {
  requireContext(client,orgId);
  requireBranchId(branchId);
  const rows=[];
  try {
    for(let offset=0;;offset+=PAGE_SIZE) {
      let query=client.from("customers")
        .select("id,name,phone,email,birth_date,active,branch_id")
        .eq("org_id",orgId);
      if(branchId)query=query.or("branch_id.eq."+branchId+",branch_id.is.null");
      // Ordem secundária por ID estabiliza a paginação quando há nomes repetidos.
      // Sem esse critério, clientes podem aparecer duas vezes ou sumir entre páginas.
      const {data,error}=await query.order("name").order("id").range(offset,offset+PAGE_SIZE-1);
      if(error)throw error;
      const page=Array.isArray(data)?data:[];
      rows.push(...page);
      if(page.length<PAGE_SIZE)break;
    }
    return rows;
  } catch(error) { throw mapCustomerError(error); }
}

/**
 * Cadastra ou atualiza o cadastro do cliente dentro do salão atual.
 * @param {object} options Cliente, organização, dados e ID opcional para edição.
 * @returns {Promise<void>} Resolve após a gravação.
 */
export async function saveCustomer({client,orgId,branchId=null,customerId=null,...input}={}) {
  requireContext(client,orgId);
  requireBranchId(branchId);
  const payload=normalizeCustomer(input);
  try {
    // A filial é atribuída na criação; editar dados pessoais não transfere o cadastro de unidade.
    // A filial ativa limita alterações, mantendo cadastros compartilhados (branch_id nulo).
    let updateQuery=customerId ? client.from("customers").update(payload).eq("org_id",orgId).eq("id",customerId) : null;
    if(updateQuery&&branchId)updateQuery=updateQuery.or("branch_id.eq."+branchId+",branch_id.is.null");
    const result=customerId
      ? await updateQuery.select("id").maybeSingle()
      : await client.from("customers").insert({org_id:orgId,...(branchId?{branch_id:branchId}:{}),...payload}).select("id").single();
    if(result.error)throw result.error;
    if(!result.data?.id)throw Object.assign(new Error("Cliente não encontrado."),{code:"P0002"});
  } catch(error) { throw mapCustomerError(error); }
}

/**
 * Inativa ou reativa cadastro local sem excluir histórico de atendimentos.
 * @param {object} options Cliente, organização, cadastro e estado desejado.
 * @returns {Promise<void>} Resolve após atualizar o estado.
 */
export async function setCustomerActive({client,orgId,branchId=null,customerId,active}={}) {
  requireContext(client,orgId);
  requireBranchId(branchId);
  if(!customerId||typeof active!=="boolean")throw new TypeError("Selecione um cliente e uma situação válida.");
  try {
    let query=client.from("customers").update({active}).eq("org_id",orgId).eq("id",customerId);
    if(branchId)query=query.or("branch_id.eq."+branchId+",branch_id.is.null");
    const {data,error}=await query.select("id").maybeSingle();
    if(error)throw error;
    if(!data?.id)throw Object.assign(new Error("Cliente não encontrado."),{code:"P0002"});
  } catch(error) { throw mapCustomerError(error); }
}
