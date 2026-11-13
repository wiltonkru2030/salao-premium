/**
 * Operações de aplicação do Caixa.
 * Centraliza validações de entrada e contratos RPC; a atomicidade é garantida pelo Postgres.
 */
export async function openCashRegister({supabase,orgId,openingAmount}) {
  const amount=Number(openingAmount);
  if(!orgId)throw new Error("Organização não identificada.");
  if(!Number.isFinite(amount)||amount<0)throw new Error("Informe um valor inicial válido.");
  return supabase.rpc("open_cash_register",{p_org_id:orgId,p_opening_amount:amount});
}

/** Fecha o caixa indicado; o servidor bloqueia a linha e calcula a diferença transacionalmente. */
export async function closeCashRegister({supabase,cashRegisterId,closingAmount}) {
  const amount=Number(closingAmount);
  if(!cashRegisterId)throw new Error("Não há caixa aberto para fechar.");
  if(!Number.isFinite(amount)||amount<0)throw new Error("Informe o valor contado.");
  return supabase.rpc("close_cash_register",{p_cash_register_id:cashRegisterId,p_closing_amount:amount});
}
