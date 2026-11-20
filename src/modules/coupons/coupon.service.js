/**
 * Serviço de domínio e persistência de cupons do SALÃO PREMIUM.
 * Responsabilidade: validar formulários, consultar dados do tenant e executar RPCs transacionais.
 * Ecossistema: Painel administrativo; o banco mantém RLS, limites e integridade.
 */
import { parseBRL } from "../../utils/input-masks.js";
const PAGE_SIZE=250;

/** Converte erro PostgREST em mensagem segura e localizada. */
function mapCouponError(error) {
  if(error?.code==="23505")return new Error("Já existe um cupom com esse código nesta organização.");
  if(["PGRST202","PGRST205","42P01","42883"].includes(error?.code))return new Error("O módulo de cupons ainda não foi ativado no banco de dados.");
  if(error?.code==="42501")return new Error("Você não tem permissão para gerenciar cupons.");
  return new Error("Não foi possível concluir a operação de cupons. Tente novamente.");
}

/** Lê todas as páginas de uma tabela com escopo obrigatório por organização. */
async function readAll(client,table,columns,orgId,{orderBy=null,activeOnly=false}={}) {
  const rows=[];
  for(let offset=0;;offset+=PAGE_SIZE) {
    let query=client.from(table).select(columns).eq("org_id",orgId);
    if(activeOnly)query=query.eq("active",true);
    if(orderBy)query=query.order(orderBy,{ascending:orderBy!=="created_at"});
    const {data,error}=await query.range(offset,offset+PAGE_SIZE-1);
    if(error)throw mapCouponError(error);
    const page=Array.isArray(data)?data:[];
    rows.push(...page);
    if(page.length<PAGE_SIZE)break;
  }
  return rows;
}

/**
 * Lista cupons, serviços, unidades, mapeamentos e resgates do tenant.
 * @param {object} options Cliente Supabase e organização ativa.
 * @returns {Promise<object>} Conjunto de dados reais da página.
 */
export async function listCoupons({client,orgId}={}) {
  if(!client?.from||!orgId)throw new TypeError("A organização ativa não foi identificada.");
  const [coupons,services,branches,mappings,redemptions]=await Promise.all([
    readAll(client,"salon_coupons","*",orgId,{orderBy:"created_at"}),
    readAll(client,"services","id,name,active",orgId,{orderBy:"name",activeOnly:true}),
    readAll(client,"branches","id,name,active",orgId,{orderBy:"name",activeOnly:true}),
    readAll(client,"salon_coupon_services","coupon_id,service_id",orgId),
    readAll(client,"customer_coupon_redemptions","coupon_id,status",orgId)
  ]);
  const serviceIdsByCoupon=new Map();
  mappings.forEach(row=>{
    if(!serviceIdsByCoupon.has(row.coupon_id))serviceIdsByCoupon.set(row.coupon_id,[]);
    serviceIdsByCoupon.get(row.coupon_id).push(row.service_id);
  });
  const couponsWithServices=coupons.map(row=>({...row,serviceIds:serviceIdsByCoupon.get(row.id)||[]}));
  return {coupons:couponsWithServices,services,branches,redemptions};
}

/**
 * Normaliza e valida o formulário do modal para o contrato da RPC.
 * @param {FormData} formData Formulário HTML.
 * @param {string} orgId Organização ativa.
 * @returns {object} Argumentos nomeados da RPC save_salon_coupon.
 * @throws {TypeError} Para entradas ausentes ou inválidas.
 */
export function buildCouponPayload(formData,orgId) {
  if(!formData||typeof formData.get!=="function"||!orgId)throw new TypeError("Não foi possível ler o formulário do cupom.");
  const value=key=>String(formData.get(key)??"").trim();
  const code=value("code").toUpperCase();
  const title=value("title");
  const discountType=value("discount_type");
  const discountValue=parseBRL(value("discount_value"));
  const maxDiscountRaw=value("max_discount_amount");
  const minimumAmount=parseBRL(value("minimum_amount")||"0");
  const startsAt=new Date(value("starts_at"));
  const endsAt=new Date(value("ends_at"));
  const usageLimitRaw=value("usage_limit");
  const usagePerCustomer=Number(value("usage_per_customer"));
  const description=value("description");
  const serviceIds=[...new Set(formData.getAll("service_ids").map(String))];
  if(!/^[A-Z0-9_-]{3,32}$/.test(code))throw new TypeError("Informe um código com 3 a 32 letras, números, hífen ou sublinhado.");
  if(title.length<2||title.length>120)throw new TypeError("Informe o nome da campanha.");
  if(description.length>500)throw new TypeError("A descrição ultrapassou 500 caracteres.");
  if(!["percent","fixed"].includes(discountType)||!Number.isFinite(discountValue)||discountValue<=0||
     (discountType==="percent"&&discountValue>100))throw new TypeError("Informe um desconto percentual ou fixo válido.");
  if(!Number.isFinite(minimumAmount)||minimumAmount<0)throw new TypeError("Informe um valor mínimo válido.");
  const parsedMaxDiscount=maxDiscountRaw?parseBRL(maxDiscountRaw):null;
  const maxDiscount=parsedMaxDiscount&&parsedMaxDiscount>0?parsedMaxDiscount:null;
  if(!Number.isFinite(startsAt.getTime())||!Number.isFinite(endsAt.getTime())||endsAt<=startsAt)throw new TypeError("Informe um período de validade correto.");
  if(!Number.isInteger(usagePerCustomer)||usagePerCustomer<1)throw new TypeError("O limite por cliente precisa ser pelo menos 1.");
  if(usageLimitRaw&&(!Number.isInteger(Number(usageLimitRaw))||Number(usageLimitRaw)<1))throw new TypeError("O limite total precisa ser um número inteiro positivo.");
  return {
    p_org_id:orgId,
    p_coupon_id:value("coupon_id")||null,
    p_branch_id:value("branch_id")||null,
    p_code:code,p_title:title,p_description:description||null,
    p_discount_type:discountType,p_discount_value:discountValue,
    p_max_discount_amount:maxDiscount,p_minimum_amount:minimumAmount,
    p_starts_at:startsAt.toISOString(),p_ends_at:endsAt.toISOString(),
    p_usage_limit:usageLimitRaw?Number(usageLimitRaw):null,
    p_usage_per_customer:usagePerCustomer,p_active:formData.get("active")==="on",
    p_service_ids:serviceIds
  };
}

/**
 * Salva um cupom usando a RPC transacional, incluindo o escopo de serviços.
 * @param {object} options Cliente Supabase e payload normalizado.
 * @returns {Promise<string>} UUID do cupom salvo.
 */
export async function saveCoupon({client,payload}={}) {
  if(!client?.rpc||!payload?.p_org_id)throw new TypeError("A conexão ou organização do cupom não está disponível.");
  const {data,error}=await client.rpc("save_salon_coupon",payload);
  if(error)throw mapCouponError(error);
  if(typeof data!=="string"||!data)throw new Error("O servidor não confirmou o cadastro do cupom.");
  return data;
}

/**
 * Desativa um cupom sem excluir o histórico de resgates.
 * @param {object} options Cliente Supabase, organização e UUID.
 * @returns {Promise<boolean>} true quando o cupom foi desativado.
 */
export async function deactivateCoupon({client,orgId,couponId}={}) {
  if(!client?.rpc||!orgId||!couponId)throw new TypeError("Selecione um cupom válido.");
  const {data,error}=await client.rpc("deactivate_salon_coupon",{p_org_id:orgId,p_coupon_id:couponId});
  if(error)throw mapCouponError(error);
  return data===true;
}

/** Formata o desconto sem acessar dados externos. */
export function formatCouponDiscount(coupon) {
  return coupon.discount_type==="percent"
    ? Number(coupon.discount_value).toLocaleString("pt-BR")+"% de desconto"
    : Number(coupon.discount_value||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})+" de desconto";
}

/** Formata data/hora para input datetime-local sem deslocamento de fuso. */
export function toCouponDateTimeInput(value) {
  const date=value instanceof Date?value:new Date(value);
  if(!Number.isFinite(date.getTime()))return "";
  return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
