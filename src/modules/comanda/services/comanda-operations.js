/**
 * Operações transacionais da Comanda.
 * Centraliza validação dos argumentos; saldos, estoque, Caixa e comissões são decididos no banco.
 */
export async function registerComandaPayment({supabase,orderId,amount,paymentMethod}) {
  const value=Number(amount);
  if(!orderId)throw new Error("Comanda não identificada.");
  if(!Number.isFinite(value)||value<=0)throw new Error("Informe um valor de pagamento válido.");
  if(!["pix","cash","credit_card","debit_card","transfer","voucher","other"].includes(paymentMethod)) {
    throw new Error("Selecione uma forma de pagamento válida.");
  }
  return supabase.rpc("register_service_order_payment",{
    p_order_id:orderId,p_amount:value,p_payment_method:paymentMethod
  });
}

/** Cancela a Comanda e, quando solicitado, estorna os recebimentos parciais no Caixa. */
export async function cancelComanda({supabase,orderId,refundPayments=false}) {
  if(!orderId)throw new Error("Comanda não identificada.");
  return supabase.rpc("cancel_service_order",{
    p_order_id:orderId,p_refund_payments:Boolean(refundPayments)
  });
}
