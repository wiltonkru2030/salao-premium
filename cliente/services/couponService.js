/**
 * Serviço de validação de cupons públicos do salão.
 * Responsabilidade: obter uma prévia de desconto; a reserva transacional recalcula e reserva o uso no banco.
 * Segurança: nunca confia no desconto exibido pelo navegador para gravar o agendamento.
 */
/**
 * Normaliza código promocional para comparação sem diferenciar maiúsculas/minúsculas.
 * @param {string} value Código informado pela cliente.
 * @returns {string} Código em maiúsculas.
 * @throws {TypeError} Quando o código não atende ao formato permitido.
 */
export function normalizeCouponCode(value) {
  const code=String(value??"").trim().toUpperCase();
  if(!/^[A-Z0-9_-]{3,32}$/.test(code))throw new TypeError("Informe um código promocional válido.");
  return code;
}

const UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Valida conexão, identificadores e código de cupom antes da RPC. */
function validateCouponInput({client,orgId,branchId,serviceId,code}={}) {
  if(!client||typeof client.rpc!=="function")throw new TypeError("A conexão de cupons não está disponível.");
  for(const [value,label] of [[orgId,"Salão"],[branchId,"Unidade"],[serviceId,"Serviço"]]) {
    if(typeof value!=="string"||!UUID_PATTERN.test(value))throw new TypeError(label+" inválido.");
  }
  return normalizeCouponCode(code);
}

/** Traduz falhas da RPC sem expor detalhes do banco. */
function mapCouponError(error) {
  const code=error?.code;
  const messages={
    "42501":"Entre na sua conta para validar este cupom.",
    "22023":error?.message||"Este cupom não está disponível para esta seleção.",
    "PGRST202":"A validação de cupons ainda está sendo ativada.",
    "42883":"A validação de cupons ainda está sendo ativada.",
    "42P01":"A validação de cupons ainda está sendo ativada."
  };
  const failure=new Error(messages[code]||"Não foi possível validar o cupom. Tente novamente.");
  failure.code=["PGRST202","42883","42P01"].includes(code)?"COUPON_BACKEND_NOT_READY":"COUPON_INVALID";
  return failure;
}

/**
 * Valida cupom, filial e serviço e retorna uma prévia de preço.
 * @param {object} input Cliente Supabase, IDs e código.
 * @returns {Promise<{couponId:string,code:string,title:string,discountType:string,discountValue:number,originalAmount:number,discountAmount:number,finalAmount:number}>} Prévia calculada pelo banco; nunca é usada como fonte de verdade na gravação.
 * @throws {TypeError|Error} Para entrada inválida, cupom inelegível ou falha de rede.
 */
export async function validatePublicCoupon(input={}) {
  const code=validateCouponInput(input);
  const {data,error}=await input.client.rpc("validate_public_coupon",{
    p_org_id:input.orgId,p_branch_id:input.branchId,p_service_id:input.serviceId,p_coupon_code:code
  });
  if(error)throw mapCouponError(error);
  const row=Array.isArray(data)?data[0]:data;
  if(!row||!Number.isFinite(Number(row.original_amount))||
     !Number.isFinite(Number(row.discount_amount))||!Number.isFinite(Number(row.final_amount))) {
    throw new Error("O servidor não retornou uma prévia de cupom válida.");
  }
  return {
    couponId:row.coupon_id,code:row.code,title:row.title,
    discountType:row.discount_type,discountValue:Number(row.discount_value),
    originalAmount:Number(row.original_amount),discountAmount:Number(row.discount_amount),
    finalAmount:Number(row.final_amount)
  };
}
