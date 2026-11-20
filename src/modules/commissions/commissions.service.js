/**
 * Serviço de consulta do módulo financeiro de comissões do SALÃO PREMIUM.
 * Responsabilidade: carregar lançamentos, repasses e vínculos de Comanda com paginação integral.
 * Ecossistema: Painel Web; o app profissional possui serviço próprio e escopo ainda mais restrito.
 * Segurança: toda consulta exige org_id; RLS do Supabase continua sendo a barreira definitiva.
 */

/** Tamanho fixo das páginas para não truncar o histórico por limite arbitrário. */
export const COMMISSION_PAGE_SIZE=250;

/** Valida o cliente e o tenant antes de consultar dados financeiros. */
function validateContext(client,organizationId) {
  if(!client||typeof client.from!=="function")throw new TypeError("A conexão com o financeiro não está disponível.");
  if(typeof organizationId!=="string"||!organizationId.trim())throw new TypeError("A organização ativa não foi identificada.");
}

/**
 * Lê todas as páginas de uma consulta Supabase.
 * @param {Function} buildQuery Fábrica de consulta com filtros e ordenação já definidos.
 * @param {string} message Mensagem pt-BR para falha de consulta.
 * @returns {Promise<Array<object>>} Todos os registros disponíveis ao perfil atual.
 * @throws {Error} Quando qualquer página falhar; nunca retorna histórico incompleto.
 */
async function readAllRows(buildQuery,message) {
  const rows=[];
  try {
    for(let offset=0;;offset+=COMMISSION_PAGE_SIZE) {
      const {data,error}=await buildQuery().range(offset,offset+COMMISSION_PAGE_SIZE-1);
      if(error)throw new Error("COMMISSION_READ_FAILED");
      const page=Array.isArray(data)?data:[];
      rows.push(...page);
      if(page.length<COMMISSION_PAGE_SIZE)break;
    }
    return rows;
  } catch {
    const failure=new Error(message);
    failure.code="COMMISSION_READ_FAILED";
    throw failure;
  }
}

/**
 * Carrega lançamentos, profissionais, repasses e regras de comissão.
 * @param {object} options Dependências da consulta.
 * @param {object} options.client Cliente Supabase.
 * @param {string} options.organizationId Organização ativa.
 * @param {boolean} options.isProfessional Se a sessão é do perfil profissional.
 * @returns {Promise<object>} Dados reais para montar a página.
 */
export async function fetchCommissionPageData({client,organizationId,isProfessional=false}={}) {
  validateContext(client,organizationId);
  const [commissions,professionals,payouts,settings,services,serviceRules]=await Promise.all([
    readAllRows(()=>client.from("commissions")
      .select("id,professional_id,base_amount,rate,amount,status,paid_at,created_at,payout_id,sale_id,appointment_id,item_type,service_order_item_id,service_order_payment_id")
      .eq("org_id",organizationId).order("created_at",{ascending:false}),
      "Não foi possível carregar os lançamentos de comissão."),
    readAllRows(()=>client.from("professionals")
      .select("id,name,active").eq("org_id",organizationId).order("name"),
      "Não foi possível carregar os profissionais."),
    readAllRows(()=>client.from("commission_payouts")
      .select("id,professional_id,amount,payment_method,paid_at,notes,cash_movement_id")
      .eq("org_id",organizationId).order("paid_at",{ascending:false}),
      "Não foi possível carregar os pagamentos de comissão."),
    isProfessional?Promise.resolve([]):readAllRows(()=>client.from("app_settings")
      .select("id,setting_value").eq("org_id",organizationId)
      .is("branch_id",null).eq("setting_key","product_commission"),
      "Não foi possível carregar a configuração de comissão de produtos."),
    readAllRows(()=>client.from("services")
      .select("id,name,active").eq("org_id",organizationId).eq("active",true).order("name"),
      "Não foi possível carregar os serviços."),
    isProfessional?Promise.resolve([]):readAllRows(()=>client.from("commission_rules")
      .select("id,professional_id,service_id,rate,active,item_type")
      .eq("org_id",organizationId).eq("item_type","service").eq("active",true)
      .order("created_at",{ascending:false}),
      "Não foi possível carregar as regras de comissão.")
  ]);
  return {
    commissions,professionals,payouts,productSetting:settings[0]||null,
    services,serviceRules
  };
}

/** Divide listas grandes em lotes para não gerar URLs excessivamente longas no PostgREST. */
function chunks(values,size=200) {
  const groups=[];
  for(let index=0;index<values.length;index+=size)groups.push(values.slice(index,index+size));
  return groups;
}

/**
 * Carrega as referências de itens, pagamentos e comandas ligadas às comissões.
 * @param {object} options Cliente, organização, lançamentos e tipo de perfil.
 * @returns {Promise<object>} Mapas de referência em forma de arrays.
 */
export async function fetchCommissionReferences({client,organizationId,commissions=[],isProfessional=false}={}) {
  validateContext(client,organizationId);
  if(!Array.isArray(commissions))throw new TypeError("A lista de comissões é inválida.");
  const itemIds=[...new Set(commissions.map(row=>row.service_order_item_id).filter(Boolean))];
  const paymentIds=[...new Set(commissions.map(row=>row.service_order_payment_id).filter(Boolean))];

  async function readByIds(table,columns,ids,message) {
    if(!ids.length)return [];
    const batches=await Promise.all(chunks(ids).map(batch=>readAllRows(
      ()=>client.from(table).select(columns).eq("org_id",organizationId).in("id",batch),
      message
    )));
    return batches.flat();
  }

  const [commissionItems,commissionPayments]=await Promise.all([
    readByIds("service_order_items","id,order_id,description",itemIds,
      "Não foi possível carregar os itens das comandas."),
    isProfessional?Promise.resolve([]):readByIds("service_order_payments","id,amount,paid_at,order_id",paymentIds,
      "Não foi possível carregar os recebimentos das comandas.")
  ]);
  const orderIds=[...new Set([
    ...commissionItems.map(item=>item.order_id),
    ...commissionPayments.map(payment=>payment.order_id)
  ].filter(Boolean))];
  const commissionOrders=await readByIds("service_orders","id,order_number",orderIds,
    "Não foi possível carregar a identificação das comandas.");
  return {commissionItems,commissionPayments,commissionOrders};
}
