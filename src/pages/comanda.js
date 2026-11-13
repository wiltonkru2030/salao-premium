/** Módulo Comanda. Responsabilidade: apresentar comandas, itens, pagamentos e cancelamentos; regras financeiras finais são executadas por RPCs transacionais no Supabase. */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, toast } from "../utils.js";
import { mountAutocomplete } from "../components/autocomplete.js";
import { userErrorMessage, reportError } from "../utils/errors.js";
import { parseBRL } from "../utils/input-masks.js";

/** Módulo Comandas: consulta comandas, monta detalhes e executa lançamentos e pagamentos. */

let cleanup=[];
let selectedOrder=null;
let selectedService=null;
let selectedProduct=null;
let detailLoading=false;
const currency=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const statusLabel=v=>({open:"Aberta",in_progress:"Em atendimento",awaiting_payment:"Aguardando pagamento",partially_paid:"Pagamento parcial",closed:"Finalizada",cancelled:"Cancelada"})[v]||v;
const escapeHtml=esc;
function clearAutocomplete(){cleanup.forEach(fn=>fn());cleanup=[];}
export function comandaPage(){
 selectedOrder=null;
 return head("Comanda","Comandas criadas a partir da chegada do cliente, com serviços, produtos e pagamentos.")+
 '<div id="comanda-manager"><div class="empty-state">Carregando comandas…</div></div>';
}
// Confirma sessão e organização ativa antes de consultar comandas.
async function tenant(){
 const {data:{user},error}=await supabase.auth.getUser();
 if(error)throw error;
 if(!user||!state.organization?.id)throw new Error("Entre no sistema para acessar as comandas.");
 return {user,orgId:state.organization.id};
}
function canManage(){return ["owner","admin","manager","receptionist"].includes(state.membership?.role);}
function canPay(){return canManage()||state.membership?.professional_app_scope==="all";}
// Carrega itens, pagamentos, cliente, profissional e catálogo da comanda.
async function queryDetails(order,orgId){
 const [items,payments,customer,professional,services,products,professionals]=await Promise.all([
  supabase.from("service_order_items").select("id,item_type,description,quantity,unit_price,discount,total,professional_id,created_at").eq("org_id",orgId).eq("order_id",order.id).order("created_at"),
  supabase.from("service_order_payments").select("id,amount,payment_method,status,paid_at").eq("org_id",orgId).eq("order_id",order.id).order("paid_at"),
  order.customer_id?supabase.from("customers").select("id,name,phone").eq("org_id",orgId).eq("id",order.customer_id).maybeSingle():Promise.resolve({data:null,error:null}),
  order.assigned_professional_id?supabase.from("professionals").select("id,name").eq("org_id",orgId).eq("id",order.assigned_professional_id).maybeSingle():Promise.resolve({data:null,error:null}),
  supabase.from("services").select("id,name,price,duration_minutes").eq("org_id",orgId).eq("active",true).order("name").limit(250),
  supabase.from("products").select("id,name,sale_price,stock_quantity").eq("org_id",orgId).eq("active",true).order("name").limit(250),
  supabase.from("professionals").select("id,name").eq("org_id",orgId).eq("active",true).order("name").limit(200)
 ]);
 for(const [label,result] of [["itens",items],["pagamentos",payments],["cliente",customer],["profissional",professional],["serviços",services],["produtos",products],["equipe",professionals]]) {
  if(result.error) throw new Error("Falha ao carregar "+label+": "+userErrorMessage(result.error));
 }
 return {items:items.data||[],payments:payments.data||[],customer:customer.data,professional:professional.data,services:services.data||[],products:products.data||[],professionals:professionals.data||[]};
}
// Desenha detalhes e formulários de serviço, produto e pagamento.
function renderOrderDetails(host,order,data,orgId){
 const {items,payments,customer,professional,services,products,professionals}=data;
 const paid=payments.filter(p=>p.status==="confirmed").reduce((s,p)=>s+Number(p.amount||0),0);
 const balance=Math.max(0,Number(order.total||0)-paid);
 const editable=["open","in_progress","partially_paid","awaiting_payment"].includes(order.status);
 const allowEdit=canManage();
 const allowPay=canPay();
 const canEditItems=editable&&["owner","admin","manager"].includes(state.membership?.role)&&!payments.some(p=>p.status==="confirmed");
 const itemEditors=canEditItems?'<section class="settings-card"><h3>Editar itens</h3>'+items.map(i=>{
  const options='<option value="">Sem profissional</option>'+professionals.map(p=>'<option value="'+p.id+'"'+(i.professional_id===p.id?' selected':'')+'>'+esc(p.name)+'</option>').join("");
  return '<details class="comanda-item-editor"><summary>'+esc(i.description)+' · '+currency(i.total)+'</summary><form data-edit-comanda-item="'+i.id+'"><label>Quantidade<input class="field" name="quantity" type="number" min="0.001" step="0.001" value="'+Number(i.quantity)+'" required></label><label>Preço unitário (R$)<input class="field" name="unit_price" type="number" min="0" step="0.01" value="'+Number(i.unit_price).toFixed(2)+'" required></label><label>Desconto (R$)<input class="field" name="discount" type="number" min="0" step="0.01" value="'+Number(i.discount||0).toFixed(2)+'" required></label><label>Profissional<select class="field" name="professional_id">'+options+'</select></label><button class="btn primary" type="submit">Salvar alterações</button><button class="btn secondary" type="button" data-delete-comanda-item="'+i.id+'">Excluir item</button></form></details>';
 }).join("")+'</section>':(payments.some(p=>p.status==="confirmed")?'<p class="demo-note">Os itens ficam bloqueados após o primeiro recebimento para preservar o histórico financeiro.</p>':'');
 host.innerHTML=`
 <div class="list-toolbar"><button class="btn secondary" data-action="back-comandas">← Voltar</button><span class="result-count">Comanda #${esc(order.order_number)}</span><span class="status">${esc(statusLabel(order.status))}</span></div>
 <section class="settings-card"><h3>Cliente e atendimento</h3><div class="setting-row"><span><b>${esc(customer?.name||"Cliente não informado")}</b><small>${esc(customer?.phone||"")}</small></span><b>${esc(professional?.name||"Sem profissional")}</b></div><div class="setting-row"><span>Aberta em</span><b>${new Date(order.created_at).toLocaleString("pt-BR")}</b></div>${order.notes?'<p class="demo-note">'+esc(order.notes)+'</p>':""}</section>
 <section class="settings-card"><h3>Itens da comanda</h3>
 ${items.length?items.map(i=>'<div class="setting-row"><span><b>'+esc(i.description)+'</b><small>'+Number(i.quantity)+' × '+currency(i.unit_price)+(i.professional_id?' · '+esc(professionals.find(p=>p.id===i.professional_id)?.name||'Profissional vinculado'):' · Sem profissional')+'</small></span><b>'+currency(i.total)+'</b></div>').join(""):'<div class="empty-state">Nenhum item lançado nesta comanda.</div>'}
 <div class="setting-row"><span>Subtotal</span><b>${currency(order.subtotal)}</b></div><div class="setting-row"><span>Desconto</span><b>${currency(order.discount)}</b></div><div class="setting-row"><b>Total</b><b>${currency(order.total)}</b></div></section>${itemEditors}
 <section class="settings-card"><h3>Pagamentos</h3>
 ${payments.length?payments.map(p=>'<div class="setting-row"><span>'+currency(p.amount)+'<small>'+esc(p.payment_method)+' · '+new Date(p.paid_at).toLocaleString("pt-BR")+'</small></span><b>'+esc(p.status)+'</b></div>').join(""):'<div class="empty-state">Nenhum pagamento registrado.</div>'}
 <div class="setting-row"><span>Total recebido</span><b>${currency(paid)}</b></div><div class="setting-row"><span>Saldo restante</span><b>${currency(balance)}</b></div></section>
 ${editable&&allowEdit?`
 <section class="settings-card"><h3>Adicionar serviço</h3><form id="comanda-service-form">
 <label>Serviço<input id="comanda-service" class="field" placeholder="Digite para buscar" autocomplete="off" required></label>
 <button class="btn primary" type="submit">Adicionar serviço</button></form></section>
 <section class="settings-card"><h3>Adicionar produto</h3><form id="comanda-product-form">
 <label>Produto<input id="comanda-product" class="field" placeholder="Digite para buscar" autocomplete="off" required></label>
 <label>Quantidade<input name="quantity" class="field" type="number" min="0.001" step="0.001" value="1" required></label>
 <label>Profissional (opcional)<select name="professional_id" class="field"><option value="">Sem profissional</option>${professionals.map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join("")}</select></label>
 
 <button class="btn primary" type="submit">Adicionar produto</button><p class="demo-note">O estoque será baixado ao quitar a comanda.</p></form></section>`:''}
 ${editable&&allowPay?`
 <section class="settings-card"><h3>Receber pagamento</h3><form id="comanda-payment-form">
 <label>Valor recebido (R$)<input name="amount" class="field" type="text" inputmode="decimal" data-mask="currency" value="${balance.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}" required></label>
 <label>Forma de pagamento<select name="payment_method" class="field" required><option value="pix">PIX</option><option value="cash">Dinheiro</option><option value="credit_card">Cartão de crédito</option><option value="debit_card">Cartão de débito</option><option value="transfer">Transferência</option><option value="voucher">Voucher</option><option value="other">Outro</option></select></label>
 <button class="btn primary" type="submit" ${balance<=0?"disabled":""}>Registrar pagamento</button><p class="demo-note">Cada recebimento, inclusive parcial, gera uma entrada no Caixa. Na quitação, o sistema finaliza a venda, baixa o estoque e gera as comissões configuradas.</p></form></section>`:''}
 ${editable&&allowEdit?'<section class="settings-card"><button class="btn secondary" data-action="cancel-comanda" data-order-id="'+order.id+'">Cancelar comanda e horários vinculados</button></section>':""}
 ${order.status==="closed"?'<div class="notice">Comanda finalizada. O registro permanece no histórico.</div>':""}`;
 clearAutocomplete();
 if(editable&&allowEdit){
  selectedService=null;selectedProduct=null;
  cleanup.push(mountAutocomplete(host.querySelector("#comanda-service"),{
   search:async term=>{const {data,error}=await supabase.from("services").select("id,name,price,duration_minutes").eq("org_id",orgId).eq("active",true).ilike("name","%"+term+"%").order("name").limit(8);if(error)throw error;return data||[];},
   getLabel:item=>item.name+" · "+currency(item.price)+" · "+Number(item.duration_minutes)+" min",
   onSelect:item=>selectedService=item
  }));
  cleanup.push(mountAutocomplete(host.querySelector("#comanda-product"),{
   search:async term=>{const {data,error}=await supabase.from("products").select("id,name,sale_price,stock_quantity").eq("org_id",orgId).eq("active",true).gt("stock_quantity",0).ilike("name","%"+term+"%").order("name").limit(8);if(error)throw error;return data||[];},
   getLabel:item=>item.name+" · "+currency(item.sale_price)+" · Estoque: "+Number(item.stock_quantity||0),
   onSelect:item=>selectedProduct=item
  }));
 }

 if(canEditItems){
  host.querySelectorAll("[data-edit-comanda-item]").forEach(form=>form.addEventListener("submit",async e=>{
   e.preventDefault();const submit=form.querySelector('[type="submit"]');
   const values=new FormData(form),quantity=Number(values.get("quantity")),unitPrice=Number(values.get("unit_price")),discount=Number(values.get("discount")),professionalId=String(values.get("professional_id")||"");
   const base=quantity*unitPrice,total=base-discount;
   if(!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(unitPrice)||unitPrice<0||!Number.isFinite(discount)||discount<0||discount>base){toast("Confira quantidade, preço e desconto.");return;}
   submit.disabled=true;submit.textContent="Salvando…";
   try{
    const {error}=await supabase.from("service_order_items").update({quantity,unit_price:unitPrice,discount,total,professional_id:professionalId||null}).eq("org_id",orgId).eq("order_id",order.id).eq("id",form.dataset.editComandaItem);
    if(error)throw error;toast("Item atualizado e total da comanda recalculado.");await loadComandaPage(order.id);
   }catch(error){reportError(error,{context:"Comanda > editar item"});}
   finally{if(submit.isConnected){submit.disabled=false;submit.textContent="Salvar alterações";}}
  }));
  host.querySelectorAll("[data-delete-comanda-item]").forEach(button=>button.addEventListener("click",async()=>{
   if(!window.confirm("Excluir este item da comanda? O total será recalculado."))return;
   button.disabled=true;
   try{
    const {error}=await supabase.from("service_order_items").delete().eq("org_id",orgId).eq("order_id",order.id).eq("id",button.dataset.deleteComandaItem);
    if(error)throw error;toast("Item removido e total recalculado.");await loadComandaPage(order.id);
   }catch(error){reportError(error,{context:"Comanda > excluir item"});button.disabled=false;}
  }));
 }
 if(editable&&allowEdit){
  host.querySelector("#comanda-service-form").addEventListener("submit",async e=>{
   e.preventDefault();const form=e.currentTarget,submit=form.querySelector('[type="submit"]');
   if(!selectedService){toast("Selecione um serviço na lista.");return;}
   if(!form.reportValidity())return;
   submit.disabled=true;submit.textContent="Adicionando…";
   try{
    const {user}=await tenant(),professionalId=String(new FormData(form).get("professional_id")||""),price=Number(selectedService.price||0);

    const {error}=await supabase.from("service_order_items").insert({org_id:orgId,order_id:order.id,item_type:"service",service_id:selectedService.id,professional_id:professionalId||null,description:selectedService.name,quantity:1,unit_price:price,total:price,created_by:user.id});
    if(error)throw error;
    toast("Serviço adicionado.");await loadComandaPage(order.id);
   }catch(error){reportError(error,{context:"Comanda > adicionar serviço"});}
   finally{if(submit.isConnected){submit.disabled=false;submit.textContent="Adicionar serviço";}}
  });
  host.querySelector("#comanda-product-form").addEventListener("submit",async e=>{
   e.preventDefault();const form=e.currentTarget,submit=form.querySelector('[type="submit"]');
   if(!selectedProduct){toast("Selecione um produto na lista.");return;}
   if(!form.reportValidity())return;
   const values=new FormData(form),quantity=Number(values.get("quantity")||1),price=Number(selectedProduct.sale_price||0),professionalId=String(values.get("professional_id")||"");
   if(!Number.isFinite(quantity)||quantity<=0||quantity>Number(selectedProduct.stock_quantity||0)){toast("Quantidade inválida ou maior que o estoque.");return;}
   submit.disabled=true;submit.textContent="Adicionando…";
   try{
    const {user}=await tenant();
    const {error}=await supabase.from("service_order_items").insert({org_id:orgId,order_id:order.id,item_type:"product",product_id:selectedProduct.id,professional_id:professionalId||null,description:selectedProduct.name,quantity,unit_price:price,total:price*quantity,created_by:user.id});
    if(error)throw error;
    toast("Produto adicionado.");await loadComandaPage(order.id);
   }catch(error){reportError(error,{context:"Comanda > adicionar produto"});}
   finally{if(submit.isConnected){submit.disabled=false;submit.textContent="Adicionar produto";}}
  });
 }
 if(editable&&allowPay){
  host.querySelector("#comanda-payment-form").addEventListener("submit",async e=>{
   e.preventDefault();const form=e.currentTarget,submit=form.querySelector('[type="submit"]');
   if(!form.reportValidity())return;
   const v=new FormData(form),amount=parseBRL(v.get("amount")),method=String(v.get("payment_method"));
   if(!Number.isFinite(amount)||amount<=0){toast("Informe um valor válido.");return;}
   submit.disabled=true;submit.textContent="Registrando…";
   try{
    const {data,error}=await supabase.rpc("register_service_order_payment",{p_order_id:order.id,p_amount:amount,p_payment_method:method});
    if(error)throw error;
    toast(data?.closed?"Comanda quitada e finalizada. Estoque, caixa e comissões atualizados.":"Pagamento parcial registrado.");
    await loadComandaPage(order.id);
   }catch(error){reportError(error,{context:"Comanda > registrar pagamento"});}
   finally{if(submit.isConnected){submit.disabled=false;submit.textContent="Registrar pagamento";}}
  });
 }
}
// Controla carregamento da lista ou dos detalhes de uma comanda.
export async function loadComandaPage(orderId=null){
 const host=document.querySelector("#comanda-manager");if(!host)return;
 clearAutocomplete();
 try{
  const {orgId}=await tenant();
  if(orderId||selectedOrder){
   const {data:order,error}=await supabase.from("service_orders").select("id,order_number,status,total,subtotal,discount,notes,customer_id,assigned_professional_id,appointment_id,created_at,branch_id").eq("org_id",orgId).eq("id",orderId||selectedOrder).maybeSingle();
   if(error)throw error;if(!order)throw new Error("Comanda não encontrada.");
   selectedOrder=order.id;const details=await queryDetails(order,orgId);renderOrderDetails(host,order,details,orgId);return;
  }
  const {data:orders,error}=await supabase.from("service_orders").select("id,order_number,status,total,created_at,customer_id,assigned_professional_id").eq("org_id",orgId).order("created_at",{ascending:false}).limit(200);
  if(error)throw error;
  const customersIds=[...new Set((orders||[]).map(o=>o.customer_id).filter(Boolean))],professionalIds=[...new Set((orders||[]).map(o=>o.assigned_professional_id).filter(Boolean))];
  const [customers,professionals]=await Promise.all([
   customersIds.length?supabase.from("customers").select("id,name").eq("org_id",orgId).in("id",customersIds):Promise.resolve({data:[]}),
   professionalIds.length?supabase.from("professionals").select("id,name").eq("org_id",orgId).in("id",professionalIds):Promise.resolve({data:[]})
  ]);
  if(customers.error)throw new Error("Falha ao carregar clientes das comandas: "+userErrorMessage(customers.error));
  if(professionals.error)throw new Error("Falha ao carregar profissionais das comandas: "+userErrorMessage(professionals.error));
  const customerMap=new Map((customers.data||[]).map(c=>[c.id,c.name])),professionalMap=new Map((professionals.data||[]).map(p=>[p.id,p.name]));
  host.innerHTML='<div class="list-toolbar"><label class="search-box"><span>⌕</span><input id="comanda-search" placeholder="Buscar cliente, profissional ou número"></label><span class="result-count">'+(orders?.length||0)+' comandas</span></div>'+
   '<div class="record-list">'+(orders||[]).map(o=>'<button class="record-card" data-open-comanda="'+o.id+'"><span class="record-main"><b>Comanda #'+esc(o.order_number)+'</b><small>'+esc(customerMap.get(o.customer_id)||"Cliente não informado")+'</small><small>'+esc(professionalMap.get(o.assigned_professional_id)||"Sem profissional")+'</small></span><span class="record-trailing"><b>'+currency(o.total)+'</b><small>'+esc(statusLabel(o.status))+'</small></span><span class="record-chevron">›</span></button>').join("")+(orders?.length?"":'<div class="empty-state">Nenhuma comanda aberta. A comanda é criada quando o cliente chega e o atendimento começa na Agenda.</div>')+'</div>';
  if(host.dataset.bound!=="true"){
   host.dataset.bound="true";
   host.addEventListener("click",async e=>{
    const open=e.target.closest("[data-open-comanda]");if(open){selectedOrder=open.dataset.openComanda;await loadComandaPage(selectedOrder);return;}
    if(e.target.closest('[data-action="back-comandas"]')){selectedOrder=null;await loadComandaPage();return;}
    if(e.target.closest('[data-action="cancel-comanda"]')){
     const button=e.target.closest('[data-action="cancel-comanda"]');if(!window.confirm("Cancelar esta comanda? Os agendamentos vinculados também serão cancelados."))return;
     const {error}=await supabase.from("service_orders").update({status:"cancelled"}).eq("org_id",orgId).eq("id",button.dataset.orderId);
     if(error){reportError(error,{context:"Comanda > cancelar comanda"});return;}toast("Comanda e horários vinculados cancelados.");selectedOrder=null;await loadComandaPage();
    }
   });
   host.addEventListener("input",e=>{
    if(!e.target.matches("#comanda-search"))return;const q=e.target.value.toLocaleLowerCase("pt-BR");
    host.querySelectorAll("[data-open-comanda]").forEach(card=>card.style.display=card.textContent.toLocaleLowerCase("pt-BR").includes(q)?"":"none");
   });
  }
 }catch(error){reportError(error,{context:"Comanda > carregar dados"});host.innerHTML='<div class="empty-state">Não foi possível carregar as comandas. Atualize a página e tente novamente.</div>';}
}
