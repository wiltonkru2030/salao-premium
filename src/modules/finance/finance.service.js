/**
 * Serviço de consolidação financeira do SALÃO PREMIUM.
 * Responsabilidade: consultar movimentos efetivos de caixa e compromissos de despesas.
 * Regra: movimentos de caixa e despesas pendentes permanecem separados para evitar dupla contagem.
 * Segurança: ambas as consultas são limitadas ao tenant e protegidas por RLS.
 */
import {readFinancePages} from './finance-pagination.js';

function requireContext(client,orgId) {
  if(!client?.from)throw new TypeError("A conexão financeira não está disponível.");
  if(typeof orgId!=="string"||!orgId.trim())throw new TypeError("A organização ativa não foi identificada.");
}

/** Converte falhas de leitura em mensagens seguras em pt-BR. */
function mapFinanceError(error) {
  if(error?.code==="42501")return new Error("Seu perfil não tem permissão para consultar o financeiro.");
  if(["PGRST205","42P01"].includes(error?.code))return new Error("Os dados financeiros ainda não estão disponíveis no banco.");
  return new Error("Não foi possível carregar as informações financeiras.");
}

/**
 * Consulta movimentos do período e despesas cadastradas do tenant.
 * @param {object} options Cliente, organização, intervalo ISO e limite.
 * @returns {Promise<object>} Movimentos de caixa e despesas em coleções separadas.
 */
export async function fetchFinanceWorkspace({
  client,orgId,branchId=null,startIso,endIso,limit=500
}={}) {
  requireContext(client,orgId);
  if(!startIso||!endIso||new Date(startIso).toString()==="Invalid Date"||
     new Date(endIso).toString()==="Invalid Date"||new Date(startIso)>=new Date(endIso)) {
    throw new TypeError("Informe um período financeiro válido.");
  }
  if(!Number.isInteger(limit)||limit<1||limit>1000)throw new TypeError("Limite de consulta inválido.");
  try {
    const movementsQuery=()=>{
      let query=client.from("cash_movements").select("id,movement_type,category,description,amount,payment_method,created_at,branch_id")
        .eq("org_id",orgId).gte("created_at",startIso).lt("created_at",endIso);
      if(branchId)query=query.eq("branch_id",branchId);
      return query.order("created_at",{ascending:false}).order("id",{ascending:false});
    };
    const expensesQuery=()=>{
      let query=client.from("expenses").select("id,description,category,amount,due_date,paid_at,status,supplier,created_at,branch_id").eq("org_id",orgId);
      if(branchId)query=query.eq("branch_id",branchId);
      return query.order("due_date",{ascending:true,nullsFirst:false}).order("id",{ascending:true});
    };
    const [movements,expenses]=await Promise.all([readFinancePages(movementsQuery,Math.min(limit,500)),readFinancePages(expensesQuery,Math.min(limit,500))]);
    return {movements,expenses};
  } catch(error) { throw mapFinanceError(error); }
}
