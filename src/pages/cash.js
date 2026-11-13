/**
 * Caixa operacional — SALÃO PREMIUM.
 * Lê caixas, recebimentos, estornos e saídas por organização; abertura e fechamento
 * são transações no Supabase. Pagamentos de Comanda e comissões são lançados por RPC.
 */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, toast } from "../utils.js";
import { reportError } from "../utils/errors.js";

const money=value=>Number(value||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const dateTime=value=>value?new Date(value).toLocaleString("pt-BR"):"—";
const paymentMethodLabel=value=>({pix:"PIX",cash:"Dinheiro",credit_card:"Cartão de crédito",debit_card:"Cartão de débito",transfer:"Transferência",voucher:"Voucher",other:"Outro"})[value]||"Outro";
const categoryLabel=value=>({service_order:"Recebimento de Comanda",service_order_refund:"Estorno de Comanda",professional_commission:"Comissão profissional"})[value]||"Movimentação";
const canOperate=()=>["owner","admin","manager","receptionist","finance"].includes(state.membership?.role);


export function cashPage(){
 return head("Caixa","Abertura, conferência e histórico dos recebimentos e saídas.")+
  '<div id="cash-manager"><div class="empty-state">Carregando movimentações do caixa…</div></div>';
}

/** Carrega o caixa padrão, resume entradas/saídas e associa movimentos às Comandas. */
export async function loadCashPage(){
 const host=document.querySelector("#cash-manager");
 if(!host||!state.organization?.id)return;
 try{
  const orgId=state.organization.id;
  const today=new Date();today.setHours(0,0,0,0);
  const tomorrow=new Date(today);tomorrow.setDate(tomorrow.getDate()+1);
  const [registerResult,movementResult,paymentResult]=await Promise.all([
   supabase.from("cash_registers").select("id,opening_amount,closing_amount,expected_amount,status,opened_at,closed_at,notes").eq("org_id",orgId).is("branch_id",null).order("opened_at",{ascending:false}).limit(20),
   supabase.from("cash_movements").select("id,cash_register_id,service_order_id,movement_type,category,description,amount,payment_method,created_at,sale_id").eq("org_id",orgId).order("created_at",{ascending:false}).limit(500),
   supabase.from("service_order_payments").select("id,order_id,cash_movement_id,amount,payment_method,paid_at").eq("org_id",orgId).not("cash_movement_id","is",null).order("paid_at",{ascending:false}).limit(500)
  ]);
  if(registerResult.error)throw registerResult.error;
  if(movementResult.error)throw movementResult.error;
  if(paymentResult.error)throw paymentResult.error;
  const registers=registerResult.data||[],movements=movementResult.data||[];
  const paymentRows=paymentResult.data||[],orderIds=[...new Set([...paymentRows.map(p=>p.order_id),...movements.map(m=>m.service_order_id).filter(Boolean)])];
  const {data:orderRows,error:orderError}=orderIds.length?await supabase.from("service_orders").select("id,order_number,customer_id").eq("org_id",orgId).in("id",orderIds):{data:[],error:null};
  if(orderError)throw orderError;
  const customerIds=[...new Set((orderRows||[]).map(o=>o.customer_id).filter(Boolean))];
  const {data:customerRows,error:customerError}=customerIds.length?await supabase.from("customers").select("id,name").eq("org_id",orgId).in("id",customerIds):{data:[],error:null};
  if(customerError)throw customerError;
  const customerNames=new Map((customerRows||[]).map(c=>[c.id,c.name]));
  const orderMap=new Map((orderRows||[]).map(o=>[o.id,{...o,customerName:customerNames.get(o.customer_id)||"Cliente"}]));
  const paymentMap=new Map(paymentRows.map(p=>[p.cash_movement_id,{...p,order:orderMap.get(p.order_id)}]));
  const active=registers.find(r=>r.status==="open")||null;
  const todayMoves=movements.filter(m=>new Date(m.created_at)>=today&&new Date(m.created_at)<tomorrow);
  const sum=(rows,type)=>rows.filter(m=>m.movement_type===type).reduce((total,m)=>total+Number(m.amount||0),0);
  const income=sum(todayMoves,"income"),expense=sum(todayMoves,"expense"),net=income-expense;
  const activeNet=active?movements.filter(m=>m.cash_register_id===active.id).reduce((s,m)=>s+(m.movement_type==="income"?1:m.movement_type==="expense"?-1:0)*Number(m.amount||0),0):0;
  const history=movements.map(m=>{
   const payment=paymentMap.get(m.id),order=payment?.order||orderMap.get(m.service_order_id);
   const label=order?"Comanda #"+order.order_number+" · "+order.customerName:m.description;
   return '<article class="record-card cash-movement" data-method="'+esc(m.payment_method||"")+'" data-date="'+String(m.created_at).slice(0,10)+'" data-search="'+esc((label+" "+m.description).toLocaleLowerCase("pt-BR"))+'"><span class="record-main"><b>'+esc(label)+'</b><small>'+dateTime(m.created_at)+' · '+esc(m.payment_method?paymentMethodLabel(m.payment_method):categoryLabel(m.category))+'</small></span><span class="record-trailing"><b>'+((m.movement_type==="expense"?"−":"+")+money(m.amount))+'</b><small>'+esc(m.movement_type==="income"?"Entrada":m.movement_type==="expense"?"Saída":m.movement_type)+(payment?" · Pagamento individual":"")+'</small></span></article>';
  }).join("");
  host.innerHTML=
   '<section class="settings-card"><div class="section-title"><div><h3>Caixa atual</h3><small class="muted">'+(active?"Aberto desde "+dateTime(active.opened_at):"Nenhum caixa aberto")+'</small></div><b class="status">'+(active?"Aberto":"Fechado")+'</b></div>'+
   (active?'<div class="setting-row"><span>Valor de abertura</span><b>'+money(active.opening_amount)+'</b></div><div class="setting-row"><span>Movimentação líquida do caixa</span><b>'+money(activeNet)+'</b></div><div class="setting-row"><span>Saldo esperado</span><b>'+money(Number(active.opening_amount||0)+activeNet)+'</b></div>'+
    (canOperate()?'<form id="cash-close-form" class="form-grid"><label>Valor contado no fechamento (R$)<input class="field" name="closing_amount" type="number" min="0" step="0.01" required></label><button class="btn primary" type="submit">Conferir e fechar caixa</button></form>':"") :
    (canOperate()?'<form id="cash-open-form" class="form-grid"><label>Valor inicial (R$)<input class="field" name="opening_amount" type="number" min="0" step="0.01" value="0" required></label><button class="btn primary" type="submit">Abrir caixa</button></form>':'<p class="demo-note">Seu perfil não pode abrir ou fechar o caixa.</p>'))+
   '</section>'+
   '<section class="settings-card"><h3>Resumo de hoje</h3><div class="commission-summary"><div><small class="eyebrow">ENTRADAS</small><h2>'+money(income)+'</h2></div><div><small class="eyebrow">SAÍDAS</small><h2>'+money(expense)+'</h2></div><div><small class="eyebrow">SALDO DO DIA</small><h2>'+money(net)+'</h2></div></div></section>'+
   '<div class="section-title section-title--spaced"><h2>Movimentações</h2><span class="result-count">Últimos '+movements.length+' lançamento(s)</span></div>'+
   '<section class="settings-card cash-filters"><div class="form-grid"><label>Buscar cliente ou comanda<input class="field" id="cash-filter-search" placeholder="Nome ou número"></label><label>De<input class="field" id="cash-filter-from" type="date"></label><label>Até<input class="field" id="cash-filter-to" type="date"></label><label>Forma de pagamento<select class="field" id="cash-filter-method"><option value="">Todas</option><option value="pix">PIX</option><option value="cash">Dinheiro</option><option value="credit_card">Crédito</option><option value="debit_card">Débito</option><option value="transfer">Transferência</option><option value="voucher">Voucher</option><option value="other">Outro</option></select></label></div></section>'+
   '<div class="record-list" id="cash-movement-list">'+(history||'<div class="empty-state">Nenhuma movimentação registrada. Os pagamentos da Comanda aparecerão aqui, inclusive os parciais.</div>')+'</div>'+
   '<div class="section-title section-title--spaced"><h2>Histórico de caixas</h2></div>'+
   '<div class="record-list">'+(registers.map(r=>'<article class="record-card"><span class="record-main"><b>'+esc(r.status==="open"?"Caixa aberto":"Caixa fechado")+'</b><small>Abertura '+dateTime(r.opened_at)+(r.closed_at?' · Fechamento '+dateTime(r.closed_at):"")+'</small></span><span class="record-trailing"><b>'+money(r.status==="open"?r.opening_amount:r.closing_amount)+'</b><small>'+(r.status==="open"?"Em andamento":"Diferença: "+money(Number(r.closing_amount||0)-Number(r.expected_amount||0)))+'</small></span></article>').join("")||'<div class="empty-state">Nenhuma abertura de caixa registrada.</div>')+'</div>';

  if(host.dataset.bound!=="true"){
   host.dataset.bound="true";
   const applyCashFilters=()=>{
    const term=String(host.querySelector("#cash-filter-search")?.value||"").trim().toLocaleLowerCase("pt-BR");
    const from=host.querySelector("#cash-filter-from")?.value||"",to=host.querySelector("#cash-filter-to")?.value||"",method=host.querySelector("#cash-filter-method")?.value||"";
    host.querySelectorAll(".cash-movement").forEach(row=>{
      row.hidden=Boolean((term&&!row.dataset.search.includes(term))||(from&&row.dataset.date<from)||(to&&row.dataset.date>to)||(method&&row.dataset.method!==method));
    });
   };
   host.addEventListener("input",event=>{if(event.target.matches("#cash-filter-search,#cash-filter-from,#cash-filter-to,#cash-filter-method"))applyCashFilters();});
   host.addEventListener("change",event=>{if(event.target.matches("#cash-filter-search,#cash-filter-from,#cash-filter-to,#cash-filter-method"))applyCashFilters();});
   host.addEventListener("submit",async event=>{
    const form=event.target;
    if(!form.matches("#cash-open-form")&&!form.matches("#cash-close-form"))return;
    event.preventDefault();
    if(!canOperate()){toast("Seu perfil não pode operar o caixa.");return;}
    const button=form.querySelector('[type="submit"]');
    button.disabled=true;button.textContent="Salvando…";
    try{
     const values=new FormData(form);
     if(form.matches("#cash-open-form")){
      const opening=Number(values.get("opening_amount"));
      if(!Number.isFinite(opening)||opening<0)throw new Error("Informe um valor inicial válido.");
      const {data,error}=await supabase.rpc("open_cash_register",{p_org_id:orgId,p_opening_amount:opening});
      if(error)throw error;
      toast("Caixa aberto e registrado.");
     }else{
      const closing=Number(values.get("closing_amount"));
      if(!Number.isFinite(closing)||closing<0)throw new Error("Informe o valor contado.");
      const {data,error}=await supabase.rpc("close_cash_register",{p_cash_register_id:active?.id,p_closing_amount:closing});
      if(error)throw error;
      toast("Caixa fechado. Diferença: "+money(data?.difference||0)+".");
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
