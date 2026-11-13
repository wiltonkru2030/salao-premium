/**
 * Componente de detalhes da Comanda.
 * Recebe dados já consultados e permissões já calculadas; não acessa Supabase nem estado global.
 */
import { esc } from "../../../utils.js";
import { currency, statusLabel, paymentStatusLabel, paymentMethodLabel } from "../comanda.formatters.js";

/**
 * @param {object} order Comanda do tenant atual.
 * @param {object} data Itens, pagamentos, cliente, profissional, serviços e produtos já carregados.
 * @param {{canManage:boolean,canPay:boolean,canEditItems:boolean,canRefund:boolean}} permissions Ações autorizadas pela página.
 * @returns {{html:string,paid:number,balance:number,editable:boolean,allowEdit:boolean,allowPay:boolean,canEditItems:boolean}}
 */
export function buildComandaDetails(order,data,permissions){
 const {items,payments,customer,professional,services,products,professionals}=data;
 const paid=payments.filter(p=>p.status==="confirmed").reduce((s,p)=>s+Number(p.amount||0),0);
 const balance=Math.max(0,Number(order.total||0)-paid);
 const editable=["open","in_progress","partially_paid","awaiting_payment"].includes(order.status);
 const allowEdit=permissions.canManage;
 const allowPay=permissions.canPay;
 const canEditItems=permissions.canEditItems;
 const itemEditors=canEditItems?'<section class="settings-card"><h3>Editar itens</h3>'+items.map(i=>{
  const options='<option value="">Sem profissional</option>'+professionals.map(p=>'<option value="'+p.id+
'"'+(i.professional_id===p.id?' selected':'')+
'>'+esc(p.name)+
'</option>').join("");
  return '<details class="comanda-item-editor"><summary>'+esc(i.description)+
' · '+currency(i.total)+
'</summary><form data-edit-comanda-item="'+i.id+
'"><label>Quantidade<input class="field" name="quantity" type="number" min="0.001" step="0.001" value="'+Number(i.quantity)+
'" required></label><label>Preço unitário (R$)<input class="field" name="unit_price" type="number" min="0" step="0.01" value="'+Number(i.unit_price).toFixed(2)+
'" required></label><label>Desconto (R$)<input class="field" name="discount" type="number" min="0" step="0.01" value="'+Number(i.discount||0).toFixed(2)+
'" required></label><label>Profissional<select class="field" name="professional_id">'+options+
'</select></label><button class="btn primary" type="submit">Salvar alterações</button><button class="btn secondary" type="button" data-delete-comanda-item="'+i.id+
'">Excluir item</button></form></details>';
 }).join("")+
'</section>':(payments.some(p=>p.status==="confirmed")?'<p class="demo-note">Os itens ficam bloqueados após o primeiro recebimento para preservar o histórico financeiro.</p>':'');
 const html=`
 <div class="list-toolbar"><button class="btn secondary" data-action="back-comandas">← Voltar</button><span class="result-count">Comanda #${esc(order.order_number)}</span><span class="status">${esc(statusLabel(order.status))}</span></div><section class="settings-card"><h3>Cliente e atendimento</h3><div class="setting-row"><span><b>${esc(customer?.name||"Cliente não informado")}</b><small>${esc(customer?.phone||"")}</small></span><b>${esc(professional?.name||"Sem profissional")}</b></div><div class="setting-row"><span>Aberta em</span><b>${new Date(order.created_at).toLocaleString("pt-BR")}</b></div>${order.notes?'<p class="demo-note">'+esc(order.notes)+'</p>':""}</section><section class="settings-card"><h3>Itens da comanda</h3>
 ${items.length?items.map(i=>'<div class="setting-row"><span><b>'+esc(i.description)+'</b><small>'+Number(i.quantity)+' × '+currency(i.unit_price)+(i.professional_id?' · '+esc(professionals.find(p=>p.id===i.professional_id)?.name||'Profissional vinculado'):' · Sem profissional')+'</small></span><b>'+currency(i.total)+'</b></div>').join(""):'<div class="empty-state">Nenhum item lançado nesta comanda.</div>'}
 <div class="setting-row"><span>Subtotal</span><b>${currency(order.subtotal)}</b></div><div class="setting-row"><span>Desconto</span><b>${currency(order.discount)}</b></div><div class="setting-row"><b>Total</b><b>${currency(order.total)}</b></div></section>${itemEditors}
 <section class="settings-card"><h3>Pagamentos</h3>
 ${payments.length?payments.map(p=>'<div class="setting-row"><span>'+currency(p.amount)+'<small>'+esc(paymentMethodLabel(p.payment_method))+' · '+new Date(p.paid_at).toLocaleString("pt-BR")+(p.refunded_at?' · Estornado em '+new Date(p.refunded_at).toLocaleString("pt-BR"):'')+'</small></span><b>'+esc(paymentStatusLabel(p.status))+'</b></div>').join(""):'<div class="empty-state">Nenhum pagamento registrado.</div>'}
 <div class="setting-row"><span>Total recebido</span><b>${currency(paid)}</b></div><div class="setting-row"><span>Saldo restante</span><b>${currency(balance)}</b></div></section>
 ${editable&&allowEdit?`
 <section class="settings-card"><h3>Adicionar serviço</h3><form id="comanda-service-form"><label>Serviço<input id="comanda-service" class="field" placeholder="Digite para buscar" autocomplete="off" required></label><label>Profissional (opcional)<select name="professional_id" class="field"><option value="">Sem profissional</option>${professionals.map(p=>'<option value="'+p.id+
'">'+esc(p.name)+
'</option>').join("")}</select></label><button class="btn primary" type="submit">Adicionar serviço</button></form></section><section class="settings-card"><h3>Adicionar produto</h3><form id="comanda-product-form"><label>Produto<input id="comanda-product" class="field" placeholder="Digite para buscar" autocomplete="off" required></label><label>Quantidade<input name="quantity" class="field" type="number" min="0.001" step="0.001" value="1" required></label><label>Profissional (opcional)<select name="professional_id" class="field"><option value="">Sem profissional</option>${professionals.map(p=>'<option value="'+p.id+
'">'+esc(p.name)+
'</option>').join("")}</select></label><button class="btn primary" type="submit">Adicionar produto</button><p class="demo-note">O estoque será baixado ao quitar a comanda.</p></form></section>`:''}
 ${editable&&allowPay?`
 <section class="settings-card"><h3>Receber pagamento</h3><form id="comanda-payment-form"><label>Valor recebido (R$)<input name="amount" class="field" type="text" inputmode="decimal" data-mask="currency" value="${balance.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}" required></label><label>Forma de pagamento<select name="payment_method" class="field" required><option value="pix">PIX</option><option value="cash">Dinheiro</option><option value="credit_card">Cartão de crédito</option><option value="debit_card">Cartão de débito</option><option value="transfer">Transferência</option><option value="voucher">Voucher</option><option value="other">Outro</option></select></label><button class="btn primary" type="submit" ${balance<=0?"disabled":""}>Registrar pagamento</button><p class="demo-note">Cada recebimento, inclusive parcial, gera uma entrada no Caixa. Na quitação, o sistema finaliza a venda, baixa o estoque e gera as comissões configuradas.</p></form></section>`:''}
 ${editable&&allowEdit?(()=>{
  const hasConfirmedPayment=payments.some(p=>p.status==="confirmed");
  const canRefund=permissions.canRefund;
  if(hasConfirmedPayment&&!canRefund)return '<section class="settings-card"><p class="demo-note">Esta comanda possui recebimentos. O estorno integral e o cancelamento exigem perfil de administração ou financeiro.</p></section>';
  return '<section class="settings-card"><button class="btn secondary" data-action="cancel-comanda" data-order-id="'+order.id+'" data-refund-payments="'+(hasConfirmedPayment?'true':'false')+'">'+(hasConfirmedPayment?'Estornar recebimentos e cancelar comanda':'Cancelar comanda e horários vinculados')+'</button></section>';
})():""}
 ${order.status==="closed"?'<div class="notice">Comanda finalizada. O registro permanece no histórico.</div>':""}`;

  return {html,paid,balance,editable,allowEdit,allowPay,canEditItems};
}
