/**
 * Serviço de despesas do SALÃO PREMIUM.
 * Responsabilidade: consultar despesas e executar cadastro, pagamento e cancelamento.
 * Segurança: cadastro/consulta filtram org_id; pagamento e cancelamento usam RPCs transacionais.
 * Importante: pagar uma despesa não atualiza caixa diretamente no cliente.
 */
const PAGE_SIZE=500;
const PAYMENT_METHODS=new Set(["cash","pix","credit_card","debit_card","transfer","voucher","other"]);

/** Traduz falhas do banco em mensagens seguras para o usuário. */
function mapExpenseError(error) {
  if(error?.code==="42501")return new Error("Seu perfil não tem permissão para operar esta despesa.");
  if(error?.code==="P0002"||error?.code==="PGRST116")return new Error("A despesa não foi encontrada ou já foi alterada.");
  if(error?.code==="22023")return new Error("Confira os dados e a situação da despesa antes de continuar.");
  if(error?.code==="23503")return new Error("A unidade selecionada não pertence à organização.");
  if(["PGRST202","PGRST205","42P01"].includes(error?.code))return new Error("O módulo de despesas não está disponível no banco.");
  return new Error("Não foi possível concluir a operação de despesas.");
}

/** Valida cliente Supabase e organização ativa. */
function requireContext(client,orgId) {
  if(!client?.from||!client?.rpc)throw new TypeError("A conexão com as despesas não está disponível.");
  if(typeof orgId!=="string"||!orgId.trim())throw new TypeError("A organização ativa não foi identificada.");
}

/** Valida uma data ISO real de vencimento. */
function validDate(value) {
  if(!value)return true;
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if(!match)return false;
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  const leap=year%4===0&&(year%100!==0||year%400===0);
  const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  return month>=1&&month<=12&&day>=1&&day<=days[month-1];
}

/**
 * Lista despesas do tenant em ordem de vencimento.
 * @param {object} options Cliente Supabase, organização e limite opcional.
 * @returns {Promise<Array<object>>} Despesas recentes.
 */
export async function listExpenses({client,orgId,limit=PAGE_SIZE}={}) {
  requireContext(client,orgId);
  if(!Number.isInteger(limit)||limit<1||limit>PAGE_SIZE)throw new TypeError("Limite de consulta inválido.");
  try {
    const {data,error}=await client.from("expenses")
      .select("id,description,category,amount,due_date,paid_at,status,supplier,notes")
      .eq("org_id",orgId).order("due_date",{ascending:true,nullsFirst:false}).limit(limit);
    if(error)throw error;
    return Array.isArray(data)?data:[];
  } catch(error) { throw mapExpenseError(error); }
}

/**
 * Cadastra um compromisso financeiro pendente.
 * @param {object} options Dados da despesa, organização e usuário que cadastrou.
 * @returns {Promise<void>} Resolve após inserir o compromisso.
 */
export async function createExpense({
  client,orgId,branchId=null,createdBy=null,description,category=null,supplier=null,
  amount,dueDate=null,notes=null
}={}) {
  requireContext(client,orgId);
  const cleanDescription=String(description??"").trim(),value=Number(amount);
  if(cleanDescription.length<2||cleanDescription.length>200)throw new TypeError("Informe uma descrição entre 2 e 200 caracteres.");
  if(!Number.isFinite(value)||value<=0)throw new TypeError("O valor da despesa deve ser maior que zero.");
  if(!validDate(String(dueDate??"")))throw new TypeError("Informe uma data de vencimento válida.");
  if(String(category??"").length>80||String(supplier??"").length>160||String(notes??"").length>1000) {
    throw new TypeError("Um dos campos de texto ultrapassou o limite permitido.");
  }
  try {
    const {error}=await client.from("expenses").insert({
      org_id:orgId,branch_id:branchId||null,description:cleanDescription,
      category:String(category??"").trim()||null,supplier:String(supplier??"").trim()||null,
      amount:value,due_date:dueDate||null,notes:String(notes??"").trim()||null,
      status:"pending",created_by:createdBy||null
    });
    if(error)throw error;
  } catch(error) { throw mapExpenseError(error); }
}

/**
 * Paga despesa via RPC transacional, com opção de registrar saída no caixa.
 * @param {object} options ID, forma de pagamento e indicador de lançamento no caixa.
 * @returns {Promise<void>} Resolve após o banco confirmar o pagamento.
 */
export async function payExpense({client,orgId,expenseId,paymentMethod,useCash=true}={}) {
  requireContext(client,orgId);
  if(!expenseId||!PAYMENT_METHODS.has(paymentMethod)||typeof useCash!=="boolean") {
    throw new TypeError("Informe despesa, forma de pagamento e opção de caixa válidas.");
  }
  try {
    const {error}=await client.rpc("pay_expense",{
      p_expense_id:expenseId,p_payment_method:paymentMethod,p_use_cash:useCash
    });
    if(error)throw error;
  } catch(error) { throw mapExpenseError(error); }
}

/**
 * Cancela despesa pendente pelo RPC do banco.
 * @param {object} options Cliente, organização e ID da despesa.
 * @returns {Promise<void>} Resolve após o banco confirmar o cancelamento.
 */
export async function cancelExpense({client,orgId,expenseId}={}) {
  requireContext(client,orgId);
  if(!expenseId)throw new TypeError("Selecione uma despesa válida.");
  try {
    const {error}=await client.rpc("cancel_expense",{p_expense_id:expenseId});
    if(error)throw error;
  } catch(error) { throw mapExpenseError(error); }
}
