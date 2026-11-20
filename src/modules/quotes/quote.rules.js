/** Regras puras de proposta comercial. Quantidades são inteiras e valores são tratados em centavos. */
export function buildQuoteItem({service,professional=null,assignments=[],quantity,discountMode,discountValue,maxDiscount,allowFixedDiscount,discountAllowed}){
 if(!service?.id)throw new Error("Selecione um serviço válido.");
 const qty=Number(quantity),price=Number(service.price),value=Number(discountValue),max=Number(maxDiscount);
 if(!Number.isInteger(qty)||qty<1||qty>1000)throw new Error("Informe uma quantidade entre 1 e 1.000.");
 if(!Number.isFinite(price)||price<0||Number(price.toFixed(2))!==price)throw new Error("O preço do serviço é inválido.");
 if(!Number.isInteger(Number(service.duration_minutes))||Number(service.duration_minutes)<1)throw new Error("A duração do serviço é inválida.");
 if(!["percent","fixed"].includes(discountMode)||!Number.isFinite(value)||value<0||Number(value.toFixed(2))!==value||!Number.isFinite(max)||max<0||max>100)throw new Error("Informe um desconto válido com até duas casas decimais.");
 if(discountMode==="fixed"&&!allowFixedDiscount)throw new Error("O salão não permite desconto em valor fixo.");
 if(value>0&&!discountAllowed)throw new Error("Este serviço não permite desconto nas regras do salão.");
 if(professional&&!assignments.some(link=>link.service_id===service.id&&link.professional_id===professional.id))throw new Error("O profissional não está habilitado para este serviço.");
 const base=Math.round(price*100)*qty,requested=Math.round(value*100),limit=Math.round(max*100);
 if(!Number.isSafeInteger(base)||base>999999999999)throw new Error("O item ultrapassa o limite de valores do orçamento.");
 // Percentual em centésimos de porcentagem; desconto fixo em centavos. Evita misturar unidades.
 const discountCents=discountMode==="percent"?Number((BigInt(base)*BigInt(requested)+5000n)/10000n):requested;
 if(discountMode==="percent"&&requested>limit||discountMode==="fixed"&&(requested>base||BigInt(requested)*10000n>BigInt(base)*BigInt(limit)))throw new Error("O desconto ultrapassa o limite configurado.");
 // O gatilho atual também verifica o desconto efetivo após arredondamento.
 if(discountCents>0&&BigInt(discountCents)*10000n>BigInt(base)*BigInt(limit))throw new Error("O desconto arredondado ultrapassa o limite do salão.");
 return {serviceId:service.id,name:service.name,quantity:qty,price,duration:Number(service.duration_minutes),professionalId:professional?.id||null,professionalName:professional?.name||"",discount:discountCents/100,discountMode,discountValue:value};
}
/** Preserva o percentual original enviado ao banco, sem reconstruí-lo pelo desconto arredondado. */
export function makeQuotePayload(items){
 if(!Array.isArray(items)||items.length<1||items.length>100)throw new Error("Adicione entre 1 e 100 serviços ao orçamento.");
 return items.map(item=>({service_id:item.serviceId,professional_id:item.professionalId,quantity:item.quantity,discount_mode:item.discountMode,discount_value:item.discountValue}));
}
/** Totalização em centavos para evitar erros de ponto flutuante. */
export function calculateQuoteTotals(items){
 let subtotal=0,discount=0;
 for(const item of items){subtotal+=Math.round(item.price*100)*item.quantity;discount+=Math.round(item.discount*100);}
 if(!Number.isSafeInteger(subtotal)||!Number.isSafeInteger(discount)||subtotal>999999999999||discount>subtotal)throw new Error("O valor total do orçamento é inválido.");
 return {subtotal:subtotal/100,discount:discount/100,total:(subtotal-discount)/100};
}
