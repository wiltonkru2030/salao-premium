/** Consultas mensais dos relatórios, sem dependência da interface. */
import {readFinancePages} from "../finance/finance-pagination.js";
/** Consulta fontes financeiras e operacionais da organização no intervalo informado. */
export async function queryReports({supabase,orgId,startIso,endIso}){
 if(!supabase?.from||!orgId||!startIso||!endIso||startIso>=endIso)throw new Error("Período ou organização inválidos.");
    // Cada fonte utiliza uma data de referência própria; nenhuma lista tem limite silencioso.
    const query=(table,fields,dateField,configure=q=>q)=>()=>configure(supabase.from(table).select(fields).eq("org_id",orgId).gte(dateField,startIso).lt(dateField,endIso)).order(dateField,{ascending:false}).order("id",{ascending:false});
    const [payments,refunds,movements,closedOrders,orders,appointments,commissions,paidCommissions]=await Promise.all([
      readFinancePages(query("service_order_payments","id,amount,status,paid_at","paid_at")),
      readFinancePages(query("service_order_payments","id,amount,status,refunded_at","refunded_at",q=>q.eq("status","refunded"))),
      readFinancePages(query("cash_movements","id,movement_type,category,amount,created_at","created_at")),
      readFinancePages(query("service_orders","id,status,total,closed_at","closed_at",q=>q.eq("status","closed"))),
      readFinancePages(query("service_orders","id,status,created_at","created_at")),
      readFinancePages(query("appointments","id,status,starts_at","starts_at")),
      readFinancePages(query("commissions","id,amount,status,created_at","created_at")),
      readFinancePages(query("commissions","id,amount,paid_at","paid_at",q=>q.eq("status","paid")))
    ]);

 return {payments,refunds,movements,closedOrders,orders,appointments,commissions,paidCommissions};
}
