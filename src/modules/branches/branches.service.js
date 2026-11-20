/**
 * Serviço de unidades/filiais do SALÃO PREMIUM.
 * Responsabilidade: consultar, cadastrar, editar e inativar filiais de uma organização.
 * Segurança: todas as operações filtram org_id e dependem das políticas RLS do tenant.
 * Limite: a matriz é preservada; sua edição pertence ao cadastro da organização.
 */
const PAGE_SIZE=200;

/** Traduz falhas do Supabase em mensagens seguras para a interface. */
function mapBranchError(error) {
  if(error?.code==="23505")return new Error("Já existe uma unidade com esses dados.");
  if(error?.code==="42501")return new Error("Seu perfil não tem permissão para alterar unidades.");
  if(["PGRST205","42P01"].includes(error?.code))return new Error("O cadastro de unidades não está disponível no banco.");
  return new Error("Não foi possível concluir a operação de unidades.");
}

/** Valida conexão e organização antes de consultar ou alterar filiais. */
function requireContext(client,orgId) {
  if(!client?.from)throw new TypeError("A conexão com as unidades não está disponível.");
  if(typeof orgId!=="string"||!orgId.trim())throw new TypeError("A organização ativa não foi identificada.");
}

/** Valida e normaliza os campos editáveis de uma unidade. */
function normalizeBranch(input={}) {
  const name=String(input.name??"").trim();
  const phone=String(input.phone??"").trim();
  const email=String(input.email??"").trim().toLowerCase();
  const document=String(input.document??"").trim();
  if(name.length<2||name.length>120)throw new TypeError("Informe um nome de unidade entre 2 e 120 caracteres.");
  if(phone.length>30)throw new TypeError("O telefone deve ter até 30 caracteres.");
  if(email.length>160||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))throw new TypeError("Informe um e-mail válido.");
  if(document.length>30)throw new TypeError("O documento deve ter até 30 caracteres.");
  return {name,phone:phone||null,email:email||null,document:document||null};
}

/**
 * Lista unidades da organização com paginação e matriz primeiro.
 * @param {object} options Cliente Supabase e organização.
 * @returns {Promise<Array<object>>} Filiais ativas e inativas.
 */
export async function listBranches({client,orgId}={}) {
  requireContext(client,orgId);
  const rows=[];
  try {
    for(let offset=0;;offset+=PAGE_SIZE) {
      const {data,error}=await client.from("branches")
        .select("id,org_id,name,phone,email,document,is_main,active,created_at,updated_at")
        .eq("org_id",orgId).order("is_main",{ascending:false}).order("name",{ascending:true})
        .range(offset,offset+PAGE_SIZE-1);
      if(error)throw error;
      const page=Array.isArray(data)?data:[];
      rows.push(...page);
      if(page.length<PAGE_SIZE)break;
    }
    return rows;
  } catch(error) { throw mapBranchError(error); }
}

/**
 * Cria ou atualiza uma filial; não permite alterar o registro da matriz.
 * @param {object} options Cliente, organização, campos e ID opcional.
 * @returns {Promise<void>} Resolve após persistir a unidade.
 */
export async function saveBranch({client,orgId,branchId=null,...input}={}) {
  requireContext(client,orgId);
  const payload=normalizeBranch(input);
  try {
    if(branchId) {
      const {data:existing,error:readError}=await client.from("branches")
        .select("id,is_main").eq("org_id",orgId).eq("id",branchId).maybeSingle();
      if(readError)throw readError;
      if(!existing)throw new Error("A unidade selecionada não foi encontrada.");
      if(existing.is_main)throw new TypeError("Os dados da matriz devem ser alterados no cadastro da organização.");
      const {error}=await client.from("branches").update(payload).eq("org_id",orgId).eq("id",branchId);
      if(error)throw error;
    } else {
      const {error}=await client.from("branches").insert({
        org_id:orgId,...payload,address:{},is_main:false,active:true
      });
      if(error)throw error;
    }
  } catch(error) {
    if(error instanceof TypeError)throw error;
    throw mapBranchError(error);
  }
}

/**
 * Inativa ou reativa uma filial sem excluir histórico de agenda e vendas.
 * @param {object} options Cliente, organização, filial e estado desejado.
 * @returns {Promise<void>} Resolve após atualizar a situação.
 */
export async function setBranchActive({client,orgId,branchId,active}={}) {
  requireContext(client,orgId);
  if(!branchId||typeof active!=="boolean")throw new TypeError("Selecione uma unidade e uma situação válida.");
  try {
    const {data:existing,error:readError}=await client.from("branches")
      .select("id,is_main").eq("org_id",orgId).eq("id",branchId).maybeSingle();
    if(readError)throw readError;
    if(!existing)throw new Error("A unidade selecionada não foi encontrada.");
    if(existing.is_main)throw new TypeError("A matriz não pode ser inativada.");
    const {error}=await client.from("branches").update({active,updated_at:new Date().toISOString()})
      .eq("org_id",orgId).eq("id",branchId);
    if(error)throw error;
  } catch(error) {
    if(error instanceof TypeError)throw error;
    throw mapBranchError(error);
  }
}
