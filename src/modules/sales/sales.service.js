/**
 * Serviço de consulta de vendas do SALÃO PREMIUM.
 * Responsabilidade: carregar vendas, clientes e itens para a visão de histórico.
 * Segurança: todas as consultas são limitadas ao org_id; não realiza mutações financeiras.
 */
function requireContext(client,orgId) {
  if(!client?.from)throw new TypeError("A conexão com o histórico de vendas não está disponível.");
  if(typeof orgId!=="string"||!orgId.trim())throw new TypeError("A organização ativa não foi identificada.");
}

/** Traduz erros de consulta em mensagens seguras em pt-BR. */
function mapSalesError(error) {
  if(error?.code==="42501")return new Error("Seu perfil não tem permissão para consultar o histórico de vendas.");
  if(["PGRST205","42P01"].includes(error?.code))return new Error("O histórico de vendas ainda não está disponível no banco.");
  return new Error("Não foi possível carregar o histórico de vendas.");
}

/**
 * Carrega as vendas recentes e os registros relacionados em lote.
 * @param {object} options Cliente Supabase, organização e limite opcional.
 * @returns {Promise<object>} Vendas, nomes de clientes e itens agrupados por venda.
 */
export async function fetchSalesWorkspace({client,orgId,limit=200}={}) {
  requireContext(client,orgId);
  if(!Number.isInteger(limit)||limit<1||limit>500)throw new TypeError("O limite de consulta deve ficar entre 1 e 500.");
  try {
    const {data:sales,error:salesError}=await client.from("sales")
      .select("id,sale_number,status,subtotal,discount,total,payment_method,notes,sold_at,customer_id,branch_id")
      .eq("org_id",orgId).order("sold_at",{ascending:false}).limit(limit);
    if(salesError)throw salesError;
    const rows=Array.isArray(sales)?sales:[];
    const customerIds=[...new Set(rows.map(row=>row.customer_id).filter(Boolean))];
    const saleIds=rows.map(row=>row.id);
    const [customerResult,itemResult]=await Promise.all([
      customerIds.length
        ?client.from("customers").select("id,name").eq("org_id",orgId).in("id",customerIds)
        :Promise.resolve({data:[],error:null}),
      saleIds.length
        ?client.from("sale_items").select("id,sale_id,description,quantity,unit_price,discount,total")
          .eq("org_id",orgId).in("sale_id",saleIds).order("created_at",{ascending:true})
        :Promise.resolve({data:[],error:null})
    ]);
    if(customerResult.error)throw customerResult.error;
    if(itemResult.error)throw itemResult.error;
    const customers=new Map((customerResult.data||[]).map(customer=>[customer.id,customer.name]));
    const itemsBySale=new Map();
    for(const item of itemResult.data||[]) {
      const list=itemsBySale.get(item.sale_id)||[];
      list.push(item);
      itemsBySale.set(item.sale_id,list);
    }
    return {sales:rows,customers,itemsBySale};
  } catch(error) { throw mapSalesError(error); }
}
