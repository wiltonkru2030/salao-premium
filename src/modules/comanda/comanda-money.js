/**
 * Regras monetárias dos itens da Comanda. Calcula totais em centavos.
 */
/**
 * Valida quantidade, preço e desconto e devolve total em reais.
 * @throws {Error} Valores inválidos ou fora da precisão monetária.
 */
export function calculateComandaItemTotal(quantity,unitPrice,discount=0){
 if(!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(unitPrice)||unitPrice<0||!Number.isFinite(discount)||discount<0||Number(unitPrice.toFixed(2))!==unitPrice||Number(discount.toFixed(2))!==discount)throw new Error("Confira quantidade, preço e desconto.");
 const base=Math.round(quantity*Math.round(unitPrice*100)),deduction=Math.round(discount*100);
 if(!Number.isSafeInteger(base)||deduction>base)throw new Error("O desconto não pode ultrapassar o valor do item.");
 return (base-deduction)/100;
}
