/**
 * Caixa operacional — SALÃO PREMIUM.
 * Consulta e opera caixas por organização e filial; abertura/fechamento são RPCs transacionais.
 */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, toast } from "../utils.js";
import { reportError } from "../utils/errors.js";
import { renderCashDashboard } from "../modules/cash/components/cash-dashboard.js";
import { openCashRegister, closeCashRegister, getCashRegisterSummary } from "../modules/cash/services/cash-operations.js";

/** Renderiza a estrutura da página de Caixa e seu estado inicial de carregamento. */
export function cashPage(){
 return head("Caixa","Abertura, conferência e histórico dos recebimentos e saídas.")+
  '<div id="cash-manager"><div class="empty-state">Carregando movimentações do caixa…</div></div>';
}

/** Carrega os dados somente da unidade selecionada e conecta operações autorizadas. */
export async function loadCashPage(){
 const host=document.querySelector("#cash-manager");
 if(!host||!state.organization?.id)return;
 try{
  const orgId=state.organization.id;
  const selectedBranchId=host.dataset.branchId!==undefined?host.dataset.branchId:(state.branch?.isAll?"__all__":state.branch?.id||"");
  const branchFilter=selectedBranchId==="__all__"?null:selectedBranchId?{method:"eq",value:selectedBranchId}:{method:"is",value:null};
  const today=new Date();today.setHours(0,0,0,0);
  const tomorrow=new Date(today);tomorrow.setDate(tomorrow.getDate()+1);
  let registerQuery=supabase.from("cash_registers").select("id,org_id,branch_id,opening_amount,closing_amount,expected_amount,status,opened_at,closed_at,notes").eq("org_id",orgId);
  let movementQuery=supabase.from("cash_movements").select("id,cash_register_id,branch_id,service_order_id,movement_type,category,description,amount,payment_method,created_at,sale_id").eq("org_id",orgId);
  if(branchFilter) {
   registerQuery=registerQuery[branchFilter.method]("branch_id",branchFilter.value);
   movementQuery=movementQuery[branchFilter.method]("branch_id",branchFilter.value);
  }
  const [branchResult,registerResult,movementResult,paymentResult]=await Promise.all([
   supabase.from("branches").select("id,name,is_main,active").eq("org_id",orgId).order("active",{ascending:false}).order("is_main",{ascending:false}).order("name",{ascending:true}).limit(200),
   registerQuery.order("opened_at",{ascending:false}).limit(50),
   movementQuery.order("created_at",{ascending:false}).limit(500),
   supabase.from("service_order_payments").select("id,order_id,cash_movement_id,amount,payment_method,paid_at").eq("org_id",orgId).not("cash_movement_id","is",null).order("paid_at",{ascending:false}).limit(500)
  ]);
  if(branchResult.error)throw branchResult.error;
  if(registerResult.error)throw registerResult.error;
  if(movementResult.error)throw movementResult.error;
  if(paymentResult.error)throw paymentResult.error;
  const branches=branchResult.data||[],registers=registerResult.data||[],movements=movementResult.data||[];
  if(selectedBranchId&&!branches.some(branch=>branch.id===selectedBranchId)){
   host.dataset.branchId="";
   return loadCashPage();
  }
  const paymentRows=paymentResult.data||[],orderIds=[...new Set([...paymentRows.map(p=>p.order_id),...movements.map(m=>m.service_order_id).filter(Boolean)])];
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
  const todayMoves=movements.filter(m=>new Date(m.created_at)>=today&&new Date(m.created_at)<tomorrow);
  const sum=(rows,type)=>rows.filter(m=>m.movement_type===type).reduce((total,m)=>total+Number(m.amount||0),0);
  const income=sum(todayMoves,"income"),expense=sum(todayMoves,"expense"),net=income-expense;
  let activeNet=0;
  if(active){
   const {data:cashSummary,error:summaryError}=await getCashRegisterSummary({supabase,cashRegisterId:active.id});
   if(summaryError)throw summaryError;
   activeNet=Number(cashSummary?.cash_income||0)-Number(cashSummary?.cash_expense||0);
  }
  const history=movements.map(m=>{
   const payment=paymentMap.get(m.id),order=payment?.order||orderMap.get(m.service_order_id);
   const label=order?"Comanda #"+order.order_number+" · "+order.customerName:m.description;
   return '<article class="record-card cash-movement" data-method="'+esc(m.payment_method||"")+
'" data-date="'+String(m.created_at).slice(0,10)+
'" data-search="'+esc((label+" "+m.description).toLocaleLowerCase("pt-BR"))+
'"><span class="record-main"><b>'+esc(label)+
'</b><small>'+new Date(m.created_at).toLocaleString("pt-BR")+
' · '+esc(m.payment_method?({pix:"PIX",cash:"Dinheiro",credit_card:"Cartão de crédito",debit_card:"Cartão de débito",transfer:"Transferência",voucher:"Voucher",other:"Outro"}[m.payment_method]||"Outro"):(m.category||"Movimentação"))+
'</small></span><span class="record-trailing"><b>'+((m.movement_type==="expense"?"−":"+")+Number(m.amount||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}))+
'</b><small>'+esc(m.movement_type==="income"?"Entrada":m.movement_type==="expense"?"Saída":m.movement_type)+(payment?" · Pagamento individual":"")+
'</small></span></article>';
  }).join("");
  host.dataset.activeRegisterId=active?.id||"";
  host.innerHTML=renderCashDashboard({
   active,activeNet,income,expense,net,movements,history,registers,branches,selectedBranchId,canOperate:["owner","admin","manager","receptionist","finance"].includes(state.membership?.role)
  });
  if(host.dataset.bound!=="true"){
   host.dataset.bound="true";
   const applyCashFilters=()=>{
    const term=String(host.querySelector("#cash-filter-search")?.value||"").trim().toLocaleLowerCase("pt-BR");
    const from=host.querySelector("#cash-filter-from")?.value||"",to=host.querySelector("#cash-filter-to")?.value||"",method=host.querySelector("#cash-filter-method")?.value||"";
    host.querySelectorAll(".cash-movement").forEach(row=>{row.hidden=Boolean((term&&!row.dataset.search.includes(term))||(from&&row.dataset.date<from)||(to&&row.dataset.date>to)||(method&&row.dataset.method!==method));});
   };
   host.addEventListener("input",event=>{if(event.target.matches("#cash-filter-search,#cash-filter-from,#cash-filter-to,#cash-filter-method"))applyCashFilters();});
   host.addEventListener("change",async event=>{
    if(event.target.matches("#cash-branch-select")){
     host.dataset.branchId=String(event.target.value||"");
     await loadCashPage();
     return;
    }
    if(event.target.matches("#cash-filter-search,#cash-filter-from,#cash-filter-to,#cash-filter-method"))applyCashFilters();
   });
   host.addEventListener("submit",async event=>{
    const form=event.target;
    if(!form.matches("#cash-open-form")&&!form.matches("#cash-close-form"))return;
    event.preventDefault();
    if(!["owner","admin","manager","receptionist","finance"].includes(state.membership?.role)){toast("Seu perfil não pode operar o caixa.");return;}
    const button=form.querySelector('[type="submit"]');
    button.disabled=true;button.textContent="Salvando…";
    try{
     const values=new FormData(form);
     if(form.matches("#cash-open-form")){
      const {error}=await openCashRegister({supabase,orgId,branchId:host.dataset.branchId||null,openingAmount:values.get("opening_amount")});
      if(error)throw error;
      toast("Caixa aberto e registrado nesta unidade.");
     }else{
      const {data,error}=await closeCashRegister({supabase,cashRegisterId:host.dataset.activeRegisterId,closingAmount:values.get("closing_amount")});
      if(error)throw error;
      toast("Caixa fechado. Diferença: "+Number(data?.difference||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})+".");
     }
     await loadCashPage();
    }catch(error){reportError(error,{context:"Caixa > operação"});}
    finally{if(button.isConnected){button.disabled=false;button.textContent=form.matches("#cash-open-form")?"Abrir caixa":"Conferir e fechar caixa";}}
   });
  }
 }catch(error){
  reportError(error,{context:"Caixa > carregar movimentações"});
  host.innerHTML='<div class="empty-state"><b>Não foi possível carregar o Caixa.</b><small>Confira sua permissão e tente novamente.</small></div>';
 }
}
