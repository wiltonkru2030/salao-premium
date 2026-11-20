/**
 * Consultas do Caixa por organização e unidade. Não manipula a interface.
 */
import {readFinancePages,sumFinanceAmounts} from "../../finance/finance-pagination.js";
import {getCashRegisterSummary} from "./cash-operations.js";
/**
 * Carrega histórico, totais diários e saldo do caixa aberto.
 * @param {object} options Cliente, organização e unidade selecionada.
 * @returns {Promise<object>} Dados financeiros e mapas de relacionamentos.
 */
export async function queryCashDashboard({supabase,orgId,selectedBranchId}){
 if(!supabase?.from||!orgId)throw new TypeError("Contexto do Caixa inválido.");
  const branchFilter=selectedBranchId?{method:"eq",value:selectedBranchId}:{method:"is",value:null};
  const today=new Date();today.setHours(0,0,0,0);
  const tomorrow=new Date(today);tomorrow.setDate(tomorrow.getDate()+1);
  const registerQuery=supabase.from("cash_registers").select("id,org_id,branch_id,opening_amount,closing_amount,expected_amount,status,opened_at,closed_at,notes").eq("org_id",orgId)[branchFilter.method]("branch_id",branchFilter.value);
  // O filtro é pelo caixa que recebeu o lançamento, não pela unidade comercial da venda.
  const movementQuery=()=>supabase.from("cash_movements").select("id,cash_register_id,branch_id,service_order_id,movement_type,category,description,amount,payment_method,created_at,sale_id,register:cash_registers!cash_movements_org_id_cash_register_id_fkey!inner(branch_id)").eq("org_id",orgId)[branchFilter.method]("register.branch_id",branchFilter.value);
  const [branchResult,registerResult,movementResult,todayMoves]=await Promise.all([
   supabase.from("branches").select("id,name,is_main,active").eq("org_id",orgId).order("active",{ascending:false}).order("is_main",{ascending:false}).order("name",{ascending:true}).limit(200),
   registerQuery.order("opened_at",{ascending:false}).limit(50),
   movementQuery().order("created_at",{ascending:false}).order("id",{ascending:false}).limit(500),
   readFinancePages(()=>movementQuery().gte("created_at",today.toISOString()).lt("created_at",tomorrow.toISOString()).order("created_at",{ascending:false}).order("id",{ascending:false}))
  ]);
  if(branchResult.error)throw branchResult.error;
  if(registerResult.error)throw registerResult.error;
  if(movementResult.error)throw movementResult.error;
  const branches=branchResult.data||[],registers=registerResult.data||[],movements=movementResult.data||[];
  if(selectedBranchId&&!branches.some(branch=>branch.id===selectedBranchId)){
   return {invalidBranch:true};
  }
  const paymentRows=[];
  for(let i=0;i<movements.length;i+=100){
   const {data,error}=await supabase.from("service_order_payments").select("id,order_id,cash_movement_id,amount,payment_method,paid_at").eq("org_id",orgId).in("cash_movement_id",movements.slice(i,i+100).map(m=>m.id));
   if(error)throw error;
   paymentRows.push(...(data||[]));
  }
  const orderIds=[...new Set([...paymentRows.map(p=>p.order_id),...movements.map(m=>m.service_order_id).filter(Boolean)])];
  const {data:orderRows,error:orderError}=orderIds.length?await supabase.from("service_orders").select("id,order_number,customer_id").eq("org_id",orgId).in("id",orderIds):{data:[],error:null};
  if(orderError)throw orderError;
  const customerIds=[...new Set((orderRows||[]).map(o=>o.customer_id).filter(Boolean))];
  const {data:customerRows,error:customerError}=customerIds.length?await supabase.from("customers").select("id,name").eq("org_id",orgId).in("id",customerIds):{data:[],error:null};
  if(customerError)throw customerError;
  const customerNames=new Map((customerRows||[]).map(c=>[c.id,c.name]));
  const orderMap=new Map((orderRows||[]).map(o=>[o.id,{...o,customerName:customerNames.get(o.customer_id)||"Cliente"}]));
  const movementIds=new Set(movements.map(m=>m.id));
  const paymentMap=new Map(paymentRows.filter(p=>movementIds.has(p.cash_movement_id)).map(p=>[p.cash_movement_id,{...p,order:orderMap.get(p.order_id)}]));
  const active=registers.find(r=>r.status==="open")||null;
  const income=sumFinanceAmounts(todayMoves,m=>m.movement_type==="income"),expense=sumFinanceAmounts(todayMoves,m=>m.movement_type==="expense"),net=income-expense;
  let activeNet=0;
  if(active){
   const {data:cashSummary,error:summaryError}=await getCashRegisterSummary({supabase,cashRegisterId:active.id});
   if(summaryError)throw summaryError;
   activeNet=Number(cashSummary?.cash_income||0)-Number(cashSummary?.cash_expense||0);
  }
 return {branches,registers,movements,active,income,expense,net,activeNet,paymentMap,orderMap};
}
