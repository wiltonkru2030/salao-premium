/** Intenção de recebimento local, limitada ao operador, organização e comanda.
 * Guarda apenas chave, valor e método; não guarda credenciais ou dados do cliente.
 * Falha de armazenamento impede envio no modo protegido.
 */
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const methods=["pix","cash","credit_card","debit_card","transfer","voucher","other"];
/** Valida contexto e retorna acesso ao registro persistido, sem enviar requisições. */
export function createPaymentIntentStore({storage,organizationId,userId,orderId,makeId=()=>crypto.randomUUID()}){
 if(![organizationId,userId,orderId].every(id=>typeof id==="string"&&uuid.test(id)))throw new Error("Contexto de pagamento inválido.");
 const key="salao-premium:payment-intent:v1:"+[organizationId,userId,orderId].join(":");
 function valid(value){return value&&uuid.test(value.requestId)&&Number.isFinite(value.amount)&&value.amount>0&&Number(value.amount.toFixed(2))===value.amount&&methods.includes(value.paymentMethod);}
 /** Lê a intenção ainda não reconciliada; dados inválidos não são descartados automaticamente. */
 function read(){
  const raw=storage.getItem(key);if(raw===null)return null;
  let value;try{value=JSON.parse(raw);}catch{throw new Error("Registro local de pagamento indisponível. Consulte a administração.");}
  if(!valid(value))throw new Error("Registro local de pagamento inválido. Consulte a administração.");
  return value;
 }
 /** Grava antes do envio e confirma persistência; não sobrescreve intenção pendente. */
 function begin(amount,paymentMethod){
  if(read())throw new Error("Existe um recebimento pendente. Consulte ou repita essa operação primeiro.");
  const value={requestId:makeId(),amount,paymentMethod};
  if(!valid(value))throw new Error("Dados do recebimento inválidos.");
  storage.setItem(key,JSON.stringify(value));
  if(read()?.requestId!==value.requestId)throw new Error("Não foi possível preservar o identificador do recebimento.");
  return value;
 }
 /** Remove apenas a intenção confirmada pelo servidor. */
 function complete(requestId){
  if(read()?.requestId===requestId)storage.removeItem(key);
 }
 return {key,read,begin,complete};
}
/** Erros explícitos de transação podem liberar uma primeira tentativa sem confirmação anterior ambígua. */
export function isDefinitePaymentRejection(error){
 return ["22023","42501","23514","23503","23505","P0001","40001","40P01"].includes(error?.code);
}
