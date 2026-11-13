/** Módulo de Orçamentos: propostas comerciais com itens, profissionais e regras de desconto por serviço. */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, toast } from "../utils.js";
import { reportError } from "../utils/errors.js";
import { renderQuoteBuilder, renderQuoteList } from "../modules/quotes/components/quote-components.js";

/** @typedef {import("../types/tenant.types").TenantContext} TenantContext */
/** @typedef {import("../types/operations.types").QuoteRecord} QuoteRecord */

const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const statusName = value => ({draft:"Rascunho",pending:"Em análise",accepted:"Aceito",rejected:"Recusado",expired:"Expirado",cancelled:"Cancelado"})[value] || value;
let customers = [], services = [], professionals = [], items = [], selectedCustomer = null, discountRules = new Set(), maxDiscount = 0, allowFixedDiscount = true, activeQuote = null;

function allowed() { return ["owner","admin","manager","receptionist"].includes(state.membership?.role); }
function totals() {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const discount = items.reduce((sum, item) => sum + item.discount, 0);
  return { subtotal, discount, total: subtotal - discount };
}
function renderBuilder() {
  const host = document.querySelector("#quote-builder");
  if (!host) return;
  host.innerHTML = renderQuoteBuilder({
    items, selectedCustomer, services, professionals, discountRules,
    maxDiscount, allowFixedDiscount,
    canManageSettings: ["owner","admin","manager"].includes(state.membership?.role)
  });
}

function renderList(quotes, customersById) {
  const host = document.querySelector("#quotes-list");
  if (!host) return;
  host.innerHTML = renderQuoteList(quotes, customersById);
}

export function quotesPage() {
  selectedCustomer=null; items=[]; activeQuote=null;
  return head("Orçamentos","Crie propostas, apresente valores e acompanhe a decisão dos clientes.")+
    '<div id="quotes-manager"><div class="empty-state">Carregando orçamentos…</div></div>';
}
/**
 * Carrega clientes, serviços, profissionais, regras e orçamentos do tenant ativo.
 * @returns {Promise<void>} Atualiza a interface sem misturar dados de organizações.
 */
export async function loadQuotesPage() {
  const host=document.querySelector("#quotes-manager");
  if(!host||!state.organization?.id)return;
  try {
    if(!allowed()) throw new Error("Seu perfil não possui acesso ao módulo de orçamentos.");
    const orgId=state.organization.id;
    const [customerResult,serviceResult,professionalResult,quoteResult,settingResult,ruleResult]=await Promise.all([
      supabase.from("customers").select("id,name,phone").eq("org_id",orgId).eq("active",true).order("name").limit(1000),
      supabase.from("services").select("id,name,price,duration_minutes").eq("org_id",orgId).eq("active",true).order("name").limit(500),
      supabase.from("professionals").select("id,name").eq("org_id",orgId).eq("active",true).order("name").limit(500),
      supabase.from("quotes").select("id,quote_number,customer_id,status,total,created_at").eq("org_id",orgId).order("created_at",{ascending:false}).limit(100),
      supabase.from("quote_settings").select("max_discount_percent,allow_fixed_discount").eq("org_id",orgId).maybeSingle(),
      supabase.from("quote_discount_services").select("service_id").eq("org_id",orgId).eq("discount_allowed",true)
    ]);
    for(const r of [customerResult,serviceResult,professionalResult,quoteResult,settingResult,ruleResult]) if(r.error) throw r.error;
    customers=customerResult.data||[]; services=serviceResult.data||[]; professionals=professionalResult.data||[];
    maxDiscount=Number(settingResult.data?.max_discount_percent||0);
    allowFixedDiscount=settingResult.data?.allow_fixed_discount!==false;
    discountRules=new Set((ruleResult.data||[]).map(r=>r.service_id));
    host.innerHTML='<div class="quote-page-grid"><div><div id="quote-builder"></div></div><div id="quotes-list"></div></div>';
    renderBuilder();
    renderList(quoteResult.data||[],new Map(customers.map(c=>[c.id,c.name])));
    if(host.dataset.bound==="true")return;
    host.dataset.bound="true";
    host.addEventListener("input",async e=>{
      if(e.target.id!=="quote-customer-search")return;
      const term=e.target.value.trim().toLocaleLowerCase("pt-BR"),box=host.querySelector("#quote-customer-results");
      if(term.length<2){box.innerHTML="";return;}
      const matches=customers.filter(c=>(c.name+" "+(c.phone||"")).toLocaleLowerCase("pt-BR").includes(term)).slice(0,8);
      box.innerHTML=matches.length?matches.map(c=>'<button type="button" class="quote-suggestion" data-select-customer="'+c.id+'"><b>'+esc(c.name)+'</b><small>'+esc(c.phone||"WhatsApp não informado")+'</small></button>').join(""):'<div class="quote-not-found">Cliente não encontrado <button class="btn secondary" type="button" id="quote-show-quick">＋ Cadastrar cliente</button></div>';
    });
    host.addEventListener("click",async e=>{
      const select=e.target.closest("[data-select-customer]");
      if(select){selectedCustomer=customers.find(c=>c.id===select.dataset.selectCustomer)||null;renderBuilder();return;}
      if(e.target.closest("#quote-show-quick")){host.querySelector("#quote-quick-customer").hidden=false;host.querySelector("#quote-quick-customer-form [name=name]").focus();return;}
      if(e.target.closest("#quote-quick-cancel")){host.querySelector("#quote-quick-customer").hidden=true;return;}
      if(e.target.closest("#quote-save")){
        if(!selectedCustomer||!items.length){toast("Selecione um cliente e adicione ao menos um serviço.");return;}
        const button=host.querySelector("#quote-save");button.disabled=true;button.textContent="Salvando orçamento…";
        try{
          const notes=host.querySelector("#quote-notes").value.trim(),validUntil=host.querySelector("#quote-valid-until").value||null;
          const payload=items.map(item=>({
            service_id:item.serviceId,professional_id:item.professionalId,quantity:item.quantity,
            discount_mode:item.discountMode,
            discount_value:item.discountMode==="percent"?(item.quantity*item.price>0?item.discount/(item.quantity*item.price)*100:0):item.discount
          }));
          const {data:quote,error}=await supabase.rpc("create_quote_with_items",{
            p_org_id:orgId,p_branch_id:state.branch?.id||null,p_customer_id:selectedCustomer.id,
            p_valid_until:validUntil,p_notes:notes,p_items:payload
          });
          if(error)throw error;
          toast("Orçamento #"+quote.quote_number+" gerado e marcado como Em análise.");
          await openQuote(quote.id,orgId);
        }catch(error){reportError(error,{context:"Orçamentos > gerar orçamento"});button.disabled=false;button.textContent="Gerar orçamento e deixar em análise";}
        return;
      }
      if(e.target.closest("#quote-add-item")){
        const service=services.find(s=>s.id===host.querySelector("#quote-service").value);
        if(!service){toast("Selecione um serviço válido.");return;}
        const quantity=Number(host.querySelector("#quote-quantity").value||1),discountInput=Number(host.querySelector("#quote-discount").value||0),discountMode=host.querySelector("#quote-discount-mode").value;
        if(!Number.isInteger(quantity)||quantity<1){toast("Informe uma quantidade válida.");return;}
        if(discountMode==="fixed"&&!allowFixedDiscount){toast("O salão não permite desconto em valor fixo.");return;}
        const base=quantity*Number(service.price),percent=discountMode==="fixed"?(base>0?discountInput/base*100:0):discountInput;
        if(discountInput>0&&!discountRules.has(service.id)){toast("Este serviço não permite desconto nas regras do salão.");return;}
        if(discountInput<0||percent>maxDiscount||discountInput>base){toast("O desconto ultrapassa o limite configurado.");return;}
        const professional=professionals.find(p=>p.id===host.querySelector("#quote-professional").value);
        items.push({serviceId:service.id,name:service.name,quantity,price:Number(service.price),duration:Number(service.duration_minutes),professionalId:professional?.id||null,professionalName:professional?.name||"",discount:Number((discountMode==="fixed"?discountInput:base*percent/100).toFixed(2)),discountMode});
        renderBuilder();return;
      }
      const remove=e.target.closest("[data-remove-quote-item]");
      if(remove){items.splice(Number(remove.dataset.removeQuoteItem),1);renderBuilder();return;}
      const open=e.target.closest("[data-open-quote]");
      if(open){await openQuote(open.dataset.openQuote,orgId);return;}
      const status=e.target.closest("[data-quote-status]");
      if(status){await changeQuoteStatus(status.dataset.quoteId,status.dataset.quoteStatus,orgId);return;}
      if(e.target.closest("#quote-schedule")){await openSchedule(activeQuote,orgId);return;}
      if(e.target.closest("#quote-print")){await printQuote(activeQuote,orgId);return;}
      if(e.target.closest("#quote-whatsapp")){const phone=activeQuote?.customer?.phone||"";if(!phone){toast("Cadastre o WhatsApp do cliente para compartilhar.");return;}let digits=phone.replace(/\D/g,"");if(digits.length===10||digits.length===11)digits="55"+digits;window.open("https://wa.me/"+digits+"?text="+encodeURIComponent("Olá! Seu orçamento do "+(state.organization?.name||"salão")+" está pronto. Vou anexar o PDF nesta conversa."),"_blank","noopener");return;}
      if(e.target.closest("#quote-back")){activeQuote=null;renderBuilder();renderList(quoteResult.data||[],new Map(customers.map(c=>[c.id,c.name])));return;}
    });
    host.addEventListener("submit",async e=>{
      if(e.target.id==="quote-quick-customer-form"){
        e.preventDefault();const form=e.target,v=new FormData(form),name=String(v.get("name")||"").trim(),phone=String(v.get("phone")||"").trim();
        if(!name||!phone){toast("Informe nome e WhatsApp.");return;}
        const button=form.querySelector('[type=submit]');button.disabled=true;
        try{const {data,error}=await supabase.from("customers").insert({org_id:orgId,name,phone}).select("id,name,phone").single();if(error)throw error;customers.push(data);selectedCustomer=data;toast("Cliente cadastrado e vinculado ao orçamento.");renderBuilder();}
        catch(error){reportError(error,{context:"Orçamentos > cadastro rápido"});}finally{button.disabled=false;}
      }
      if(e.target.id==="quote-discount-settings"){
        e.preventDefault();const form=e.target,percent=Number(new FormData(form).get("max_discount_percent"));
        if(!Number.isFinite(percent)||percent<0||percent>100){toast("Informe um limite entre 0 e 100%.");return;}
        const selected=[...form.querySelectorAll('[name="discount_service"]:checked')].map(el=>el.value),fixedAllowed=form.querySelector('[name="allow_fixed_discount"]').checked;
        try{
          const {error:settingError}=await supabase.from("quote_settings").upsert({org_id:orgId,max_discount_percent:percent,allow_fixed_discount:fixedAllowed,updated_by:state.user?.id},{onConflict:"org_id"});if(settingError)throw settingError;
          const {error:deleteError}=await supabase.from("quote_discount_services").delete().eq("org_id",orgId);if(deleteError)throw deleteError;
          if(selected.length){const {error}=await supabase.from("quote_discount_services").insert(selected.map(service_id=>({org_id:orgId,service_id,discount_allowed:true})));if(error)throw error;}
          maxDiscount=percent;allowFixedDiscount=fixedAllowed;discountRules=new Set(selected);toast("Regras de desconto salvas.");renderBuilder();
        }catch(error){reportError(error,{context:"Orçamentos > regras de desconto"});}
      }
    });

  } catch(error) {
    reportError(error,{context:"Orçamentos > carregar"});
    host.innerHTML='<div class="empty-state">Não foi possível carregar os orçamentos. Confira suas permissões e tente novamente.</div>';
  }
}
async function changeQuoteStatus(id,status,orgId){
  const update=status==="accepted"?{status,accepted_at:new Date().toISOString()}:status==="rejected"?{status,rejected_at:new Date().toISOString()}:{status};
  const {error}=await supabase.from("quotes").update(update).eq("org_id",orgId).eq("id",id);
  if(error){reportError(error,{context:"Orçamentos > alterar status"});return;}
  toast("Status do orçamento atualizado.");await loadQuotesPage();
}
async function openQuote(id,orgId){
  const host=document.querySelector("#quotes-manager");
  const [quoteResult,itemResult,professionalResult]=await Promise.all([
    supabase.from("quotes").select("*,customers(id,name,phone)").eq("org_id",orgId).eq("id",id).single(),
    supabase.from("quote_items").select("id,description,quantity,unit_price,discount_amount,total,duration_minutes,professional_id").eq("org_id",orgId).eq("quote_id",id).order("sort_order"),
    supabase.from("professionals").select("id,name").eq("org_id",orgId)
  ]);
  if(quoteResult.error)throw quoteResult.error;if(itemResult.error)throw itemResult.error;if(professionalResult.error)throw professionalResult.error;
  const professionalNames=new Map((professionalResult.data||[]).map(p=>[p.id,p.name]));
  activeQuote={...quoteResult.data,customer:quoteResult.data.customers,items:(itemResult.data||[]).map(item=>({...item,professionalName:professionalNames.get(item.professional_id)||"Profissional a definir"}))};
  host.innerHTML='<section class="settings-card quote-preview"><div class="section-title"><div><small class="eyebrow">SALÃO PREMIUM · PROPOSTA COMERCIAL</small><h2>Orçamento #'+activeQuote.quote_number+'</h2><small class="muted">'+esc(statusName(activeQuote.status))+' · '+new Date(activeQuote.created_at).toLocaleDateString("pt-BR")+'</small></div><span class="status">'+esc(statusName(activeQuote.status))+'</span></div><h3>Cliente: '+esc(activeQuote.customer?.name||"Cliente")+'</h3><div class="record-list">'+activeQuote.items.map(i=>'<div class="setting-row"><span><b>'+esc(i.description)+'</b><small>'+i.quantity+' × '+money(i.unit_price)+' · '+Number(i.duration_minutes)+' min · '+esc(i.professionalName)+'</small></span><span class="record-trailing"><b>'+money(i.total)+'</b>'+(i.discount_amount?'<small>Desconto '+money(i.discount_amount)+'</small>':'')+'</span></div>').join("")+'</div><div class="quote-totals"><div class="setting-row"><span>Subtotal</span><b>'+money(activeQuote.subtotal)+'</b></div><div class="setting-row"><span>Desconto</span><b>− '+money(activeQuote.discount_total)+'</b></div><div class="setting-row quote-grand-total"><b>Valor final</b><strong>'+money(activeQuote.total)+'</strong></div></div><p class="muted">'+esc(activeQuote.notes||"")+'</p><div class="quote-actions"><button class="btn secondary" id="quote-back">Voltar</button><button class="btn secondary" id="quote-print">Gerar PDF / Imprimir</button><button class="btn secondary" id="quote-whatsapp">Abrir WhatsApp (anexar PDF)</button>'+(activeQuote.status==="pending"?'<button class="btn primary" data-quote-status="accepted" data-quote-id="'+id+'">Marcar como aceito</button><button class="btn secondary" data-quote-status="rejected" data-quote-id="'+id+'">Marcar como recusado</button>':"")+(activeQuote.status==="accepted"?'<button class="btn primary" id="quote-schedule" data-quote-id="'+id+'">Agendar horários</button><button class="btn secondary" data-quote-status="cancelled" data-quote-id="'+id+'">Cancelar orçamento</button>':"")+'</div></section>';
}
async function printQuote(quote,orgId){
  if(!quote)return;
  const w=window.open("","_blank");
  if(!w){toast("Permita a abertura da janela para imprimir o orçamento.");return;}
  w.opener=null;
  const [orgResult,branchResult,professionalResult]=await Promise.all([
    supabase.from("organizations").select("name,document,phone").eq("id",orgId).single(),
    supabase.from("branches").select("name,document,address,phone,is_main").eq("org_id",orgId).eq("is_main",true).maybeSingle(),
    supabase.from("professionals").select("id,name").eq("org_id",orgId)
  ]);
  if(orgResult.error)throw orgResult.error;if(branchResult.error)throw branchResult.error;
  const org=orgResult.data,branch=branchResult.data,pros=new Map((professionalResult.data||[]).map(p=>[p.id,p.name]));
  const address=branch?.address||{};
  const addressText=typeof address==="string"?address:[address.street,address.number,address.district,address.city,address.state,address.zip].filter(Boolean).join(", ");
  const doc=branch?.document||org.document||"Documento não cadastrado";
  let responseUrl=null;
  if(quote.status==="pending"){
    const tokenBytes=crypto.getRandomValues(new Uint8Array(32));
    const token=[...tokenBytes].map(byte=>byte.toString(16).padStart(2,"0")).join("");
    const tokenDigest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));
    const tokenHash=[...new Uint8Array(tokenDigest)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
    const {error:tokenError}=await supabase.from("quotes").update({public_token_hash:tokenHash}).eq("org_id",orgId).eq("id",quote.id).eq("status","pending");
    if(tokenError)throw tokenError;
    responseUrl="https://vlifbvzlyzoncefvfgol.supabase.co/functions/v1/respond-to-quote?token="+token;
  }
  w.document.write('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Orçamento #'+quote.quote_number+'</title><style>body{font:15px Arial,sans-serif;color:#202020;max-width:800px;margin:40px auto;padding:24px}header{border-bottom:2px solid #b69a62;padding-bottom:18px;margin-bottom:24px}h1{font-size:28px}small{color:#666}.row{display:flex;justify-content:space-between;padding:13px 0;border-bottom:1px solid #eee}.total{font-size:24px;font-weight:bold;color:#8b7041;margin-top:20px;text-align:right}.foot{margin-top:40px;color:#666;font-size:12px}@media print{button{display:none}}</style><header><h1>'+esc(branch?.name||org.name)+'</h1><p>'+esc(addressText||"Endereço não cadastrado")+'</p><p>CPF/CNPJ: '+esc(doc)+' · '+esc(branch?.phone||org.phone||"")+'</p></header><h2>Orçamento #'+quote.quote_number+'</h2><p>Cliente: '+esc(quote.customer?.name||"")+' · WhatsApp: '+esc(quote.customer?.phone||"")+'</p>'+quote.items.map(i=>'<div class="row"><span><b>'+esc(i.description)+'</b><br><small>'+Number(i.quantity)+' × '+money(i.unit_price)+' · '+esc(pros.get(i.professional_id)||"Profissional a definir")+'</small></span><b>'+money(i.total)+'</b></div>').join("")+'<div class="row"><span>Subtotal</span><b>'+money(quote.subtotal)+'</b></div><div class="row"><span>Descontos</span><b>− '+money(quote.discount_total)+'</b></div><div class="total">Valor final: '+money(quote.total)+'</div><p>Para aceitar ou recusar esta proposta, acesse: <a href="'+responseUrl+'">Responder ao orçamento</a></p><p>Proposta: '+esc(statusName(quote.status))+(quote.valid_until?' · Válida até '+new Date(quote.valid_until+"T12:00:00").toLocaleDateString("pt-BR"):"")+'</p><footer class="foot">Orçamento gerado pelo SALÃO PREMIUM. Esta proposta não representa pagamento ou agendamento confirmado.</footer><script>window.onload=()=>window.print()<\/script></html>');
  w.document.close();
}

async function openSchedule(quote,orgId){
  const host=document.querySelector("#quotes-manager");
  const [itemsResult,proResult]=await Promise.all([
    supabase.from("quote_items").select("id,service_id,professional_id,description,quantity,duration_minutes,total").eq("org_id",orgId).eq("quote_id",quote.id).order("sort_order"),
    supabase.from("professionals").select("id,name").eq("org_id",orgId).eq("active",true).order("name")
  ]);
  if(itemsResult.error)throw itemsResult.error;if(proResult.error)throw proResult.error;
  const rows=itemsResult.data||[],pros=proResult.data||[];
  host.innerHTML='<section class="settings-card"><div class="section-title"><div><h2>Agendar orçamento #'+quote.quote_number+'</h2><small class="muted">Defina um horário independente para cada serviço.</small></div></div><form id="quote-schedule-form">'+rows.map((item,index)=>'<div class="quote-schedule-item"><h3>'+esc(item.description)+'</h3><div class="form-grid"><label>Profissional<select class="field" name="professional_'+index+'" required><option value="">Selecione</option>'+pros.map(p=>'<option value="'+p.id+'" '+(p.id===item.professional_id?'selected':'')+'>'+esc(p.name)+'</option>').join("")+'</select></label><label>Data<input class="field" type="date" name="date_'+index+'" required></label><label>Horário<input class="field" type="time" name="time_'+index+'" required></label></div><input type="hidden" name="item_'+index+'" value="'+item.id+'"><input type="hidden" name="service_'+index+'" value="'+item.service_id+'"><input type="hidden" name="duration_'+index+'" value="'+item.duration_minutes+'"><input type="hidden" name="price_'+index+'" value="'+item.total+'"></div>').join("")+'<button class="btn primary" type="submit">Confirmar todos os horários</button><button class="btn secondary" type="button" id="quote-schedule-back">Voltar</button></form></section>';
  host.querySelector("#quote-schedule-back").addEventListener("click",()=>openQuote(quote.id,orgId));
  host.querySelector("#quote-schedule-form").addEventListener("submit",async event=>{
    event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type=submit]'),values=new FormData(form);
    button.disabled=true;button.textContent="Verificando disponibilidade…";
    try{
      const prepared=rows.map((item,index)=>{
        const professionalId=String(values.get("professional_"+index)||""),date=String(values.get("date_"+index)||""),time=String(values.get("time_"+index)||"");
        const duration=Number(item.duration_minutes)*Number(item.quantity||1);
        const start=new Date(date+"T"+time+":00"),end=new Date(start.getTime()+duration*60000);
        if(!professionalId||!date||!time||Number.isNaN(start.getTime()))throw new Error("Preencha profissional, data e horário de todos os serviços.");
        return {item,professionalId,start,end};
      });
      for(let i=0;i<prepared.length;i++)for(let j=i+1;j<prepared.length;j++){
        const a=prepared[i],b=prepared[j];
        if(a.professionalId===b.professionalId&&a.start<b.end&&b.start<a.end)throw new Error("Dois serviços do mesmo profissional estão no mesmo horário. Ajuste os horários.");
      }
      const payload=prepared.map(entry=>({quote_item_id:entry.item.id,professional_id:entry.professionalId,starts_at:entry.start.toISOString(),ends_at:entry.end.toISOString()}));
      const {data:group,error}=await supabase.rpc("create_quote_appointment_group",{p_quote_id:quote.id,p_items:payload});
      if(error)throw error;
      toast("Agendamento agrupado criado com "+Number(group?.count||prepared.length)+" serviço(s).");
      await loadQuotesPage();
    }catch(error){reportError(error,{context:"Orçamentos > agendar horários"});button.disabled=false;button.textContent="Confirmar todos os horários";}
  });
}
