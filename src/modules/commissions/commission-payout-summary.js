/**
 * Regra de apresentação do repasse líquido de comissões.
 * Não acessa DOM nem API. O banco confere novamente o saldo e as permissões.
 * Recebe somente lançamentos da organização ativa, seleciona um profissional e
 * soma em centavos os créditos selecionados e todos os débitos pendentes.
 */
export function summarizeCommissionPayout({rows,professionalId,selectedIds}) {
  if(!Array.isArray(rows)||!Array.isArray(selectedIds)||!professionalId)throw new Error("Seleção de comissões inválida.");
  const selected=new Set(selectedIds);
  if(selected.size!==selectedIds.length)throw new Error("A seleção contém comissões repetidas.");
  let creditCents=0,debitCents=0,selectedCount=0;
  for(const row of rows) {
    if(row.professional_id!==professionalId||row.payout_id||!["pending","approved"].includes(row.status))continue;
    const value=Number(row.amount);
    const cents=Math.round(value*100);
    if(row.amount==null||!Number.isSafeInteger(cents)||Number(value.toFixed(2))!==value)throw new Error("Valor de comissão inválido. Atualize os lançamentos.");
    if(cents<0)debitCents-=cents;
    if(selected.has(row.id)&&cents>0){creditCents+=cents;selectedCount++;}
  }
  if(selectedCount!==selected.size)throw new Error("Uma comissão selecionada não está disponível para pagamento.");
  return {credit:creditCents/100,debit:debitCents/100,net:(creditCents-debitCents)/100};
}
