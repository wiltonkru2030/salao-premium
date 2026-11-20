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
  if(["PGRST205","42P01"].includes(error?.code))return new Error("A carteira de clientes não está disponível no banco.");
  return new Error("Não foi possível concluir a operação de clientes.");
}

/** Valida o cliente Supabase e o tenant antes de qualquer consulta. */
function requireContext(client,orgId) {
  if(!client?.from)throw new TypeError("A conexão com os clientes não está disponível.");
  if(typeof orgId!=="string"||!orgId.trim())throw new TypeError("A organização ativa não foi identificada.");
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
  if(birthDate&&!/^\d{4}-\d{2}-\d{2}$/.test(birthDate))throw new TypeError("Informe uma data de nascimento válida.");
  return {name,phone:phone||null,email:email||null,birth_date:birthDate||null};
}

/**
 * Lista todos os clientes do tenant com paginação, sem limite arbitrário de 500.
 * @param {object} options Cliente Supabase e ID da organização.
 * @returns {Promise<Array<object>>} Clientes ativos e inativos.
 */
export async function listCustomers({client,orgId}={}) {
  requireContext(client,orgId);
  const rows=[];
  try {
    for(let offset=0;;offset+=PAGE_SIZE) {
      const {data,error}=await client.from("customers")
        .select("id,name,phone,email,birth_date,active")
        .eq("org_id",orgId).order("name").range(offset,offset+PAGE_SIZE-1);
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
export async function saveCustomer({client,orgId,customerId=null,...input}={}) {
  requireContext(client,orgId);
  const payload=normalizeCustomer(input);
  try {
    const result=customerId
      ? await client.from("customers").update(payload).eq("org_id",orgId).eq("id",customerId)
      : await client.from("customers").insert({org_id:orgId,...payload});
    if(result.error)throw result.error;
  } catch(error) { throw mapCustomerError(error); }
}

/**
 * Inativa ou reativa cadastro local sem excluir histórico de atendimentos.
 * @param {object} options Cliente, organização, cadastro e estado desejado.
 * @returns {Promise<void>} Resolve após atualizar o estado.
 */
export async function setCustomerActive({client,orgId,customerId,active}={}) {
  requireContext(client,orgId);
  if(!customerId||typeof active!=="boolean")throw new TypeError("Selecione um cliente e uma situação válida.");
  try {
    const {error}=await client.from("customers").update({active}).eq("org_id",orgId).eq("id",customerId);
    if(error)throw error;
  } catch(error) { throw mapCustomerError(error); }
}
