/**
 * Operações transacionais da Comanda.
 * Centraliza validação dos argumentos; saldos, estoque, Caixa e comissões são decididos no banco.
 */
export async function registerComandaPayment({supabase,orderId,amount,paymentMethod,requestId=null}) {
  const value=Number(amount);
  if(!orderId)throw new Error("Comanda não identificada.");
  if(!Number.isFinite(value)||value<=0)throw new Error("Informe um valor de pagamento válido.");
  // Não arredondar silenciosamente: o valor recebido precisa representar centavos exatos.
  if(Number(value.toFixed(2))!==value)throw new Error("Informe o pagamento com até duas casas decimais.");
  if(!["pix","cash","credit_card","debit_card","transfer","voucher","other"].includes(paymentMethod)) {
    throw new Error("Selecione uma forma de pagamento válida.");
  }
  const args={p_order_id:orderId,p_amount:value,p_payment_method:paymentMethod};
  // Opt-in: a UI deve manter a mesma chave ao repetir uma intenção após falha ambígua.
  // Nunca gerar uma nova chave automaticamente aqui nem recorrer à RPC antiga após erro.
  if(requestId!==null){
    if(typeof requestId!=="string"||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId))throw new Error("Identificador de pagamento inválido.");
    return supabase.rpc("register_service_order_payment_once",{...args,p_request_id:requestId});
  }
  return supabase.rpc("register_service_order_payment",args);
}

/** Cancela a Comanda e, quando solicitado, estorna os recebimentos parciais no Caixa. */
export async function cancelComanda({supabase,orderId,refundPayments=false}) {
  if(!orderId)throw new Error("Comanda não identificada.");
  return supabase.rpc("cancel_service_order",{
    p_order_id:orderId,p_refund_payments:Boolean(refundPayments)
  });
}
