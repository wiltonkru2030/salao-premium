/** Módulo de Orçamentos: propostas comerciais com itens, profissionais e regras de desconto por serviço. */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, toast } from "../utils.js";
import { reportError } from "../utils/errors.js";
import { renderQuoteBuilder, renderQuoteList } from "../modules/quotes/components/quote-components.js";
import { buildQuoteItem, makeQuotePayload, calculateQuoteTotals } from "../modules/quotes/quote.rules.js";
import { printQuoteDocument, openQuoteSchedule } from "../modules/quotes/services/quote-workflows.js";

/** @typedef {import("../types/tenant.types").TenantContext} TenantContext */
/** @typedef {import("../types/operations.types").QuoteRecord} QuoteRecord */

const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const statusName = value => ({draft:"Rascunho",pending:"Em análise",accepted:"Aceito",rejected:"Recusado",expired:"Expirado",cancelled:"Cancelado"})[value] || value;
let customers = [], services = [], discountCatalog = [], professionals = [], professionalServices = [], items = [], selectedCustomer = null, discountRules = new Set(), maxDiscount = 0, allowFixedDiscount = true, activeQuote = null;

function allowed() { return ["owner","admin","manager","receptionist"].includes(state.membership?.role); }
function renderBuilder() {
  const host = document.querySelector("#quote-builder");
  if (!host) return;
  host.innerHTML = renderQuoteBuilder({
    items, selectedCustomer, services, professionals, discountRules,
    maxDiscount, allowFixedDiscount, discountCatalog,
    canManageSettings: ["owner","admin","manager"].includes(state.membership?.role)
  });
}

function renderList(quotes, customersById) {
  const host = document.querySelector("#quotes-list");
  if (!host) return;
  host.innerHTML = renderQuoteList(quotes, customersById);
}

/** Inicializa a página de Orçamentos e limpa a seleção temporária da proposta. */
export function quotesPage() {
  selectedCustomer=null; items=[]; activeQuote=null;
  return head("Orçamentos","Crie propostas, apresente valores e acompanhe a decisão dos clientes.")+

    '<div id="quotes-manager"><div class="empty-state">Carregando orçamentos…</div></div>';
}
/**
 * Carrega clientes, serviços, profissionais, regras e orçamentos do tenant ativo.
 * @returns {Promise<void>} Atualiza a interface sem misturar dados de organizações.
 */
/** Carrega catálogo, regras comerciais e orçamentos do tenant ativo e conecta os fluxos da página. */
export async function loadQuotesPage() {
  const host=document.querySelector("#quotes-manager");
  if(!host||!state.organization?.id)return;
  try {
    if(!allowed()) throw new Error("Seu perfil não possui acesso ao módulo de orçamentos.");
    const orgId=state.organization.id;
    const branchId=state.branch?.id||null;
    let customerQuery=supabase.from("customers").select("id,name,phone")
      .eq("org_id",orgId).eq("active",true);
    let serviceQuery=supabase.from("services").select("id,name,price,duration_minutes")
      .eq("org_id",orgId).eq("active",true);
    let professionalQuery=supabase.from("professionals").select("id,name")
      .eq("org_id",orgId).eq("active",true);
    let quoteQuery=supabase.from("quotes").select("id,quote_number,customer_id,status,total,created_at,branch_id")
      .eq("org_id",orgId);
    if(branchId) {
      customerQuery=customerQuery.or("branch_id.eq."+branchId+",branch_id.is.null");
      serviceQuery=serviceQuery.or("branch_id.eq."+branchId+",branch_id.is.null");
      professionalQuery=professionalQuery.or("branch_id.eq."+branchId+",branch_id.is.null");
      quoteQuery=quoteQuery.eq("branch_id",branchId);
    }
    const [customerResult,serviceResult,professionalResult,professionalServiceResult,quoteResult,settingResult,ruleResult,discountCatalogResult]=await Promise.all([
      customerQuery.order("name").limit(1000),
      serviceQuery.order("name").limit(500),
      professionalQuery.order("name").limit(500),
      supabase.from("professional_services").select("professional_id,service_id").eq("org_id",orgId),
      quoteQuery.order("created_at",{ascending:false}).limit(100),
      supabase.from("quote_settings").select("max_discount_percent,allow_fixed_discount").eq("org_id",orgId).maybeSingle(),
      supabase.from("quote_discount_services").select("service_id").eq("org_id",orgId).eq("discount_allowed",true),
      supabase.from("services").select("id,name,branch_id").eq("org_id",orgId).eq("active",true).order("name").limit(1000)
    ]);
    for(const r of [customerResult,serviceResult,professionalResult,professionalServiceResult,quoteResult,settingResult,ruleResult,discountCatalogResult]) if(r.error) throw r.error;
    if(!host.isConnected||state.organization?.id!==orgId||(state.branch?.id||null)!==branchId)return;
    customers=customerResult.data||[]; services=serviceResult.data||[]; professionals=professionalResult.data||[]; professionalServices=professionalServiceResult.data||[];
    maxDiscount=Number(settingResult.data?.max_discount_percent||0);
    allowFixedDiscount=settingResult.data?.allow_fixed_discount!==false;
    discountRules=new Set((ruleResult.data||[]).map(r=>r.service_id));
    discountCatalog=discountCatalogResult.data||[];
    // Não sobrescrever regras da organização quando o catálogo estiver truncado.
    const rulesComplete=discountCatalog.length<1000&&(ruleResult.data||[]).length<1000;
    host.dataset.discountRulesComplete=String(rulesComplete);
    host.innerHTML='<div class="quote-page-grid"><div><div id="quote-builder"></div></div><div id="quotes-list"></div></div>';
    renderBuilder();
    renderList(quoteResult.data||[],new Map(customers.map(c=>[c.id,c.name])));
    if(host.dataset.bound==="true")return;
    host.dataset.bound="true";
    const current=()=>host.isConnected&&state.organization?.id===orgId&&(state.branch?.id||null)===branchId;
    host.addEventListener("change",event=>{
      if(!current())return;
      if(event.target.id!=="quote-service")return;
      const serviceId=event.target.value,professionalSelect=host.querySelector("#quote-professional");
      if(!professionalSelect)return;
      const eligibleIds=new Set(professionalServices.filter(link=>link.service_id===serviceId).map(link=>link.professional_id));
      const eligible=professionals.filter(professional=>eligibleIds.has(professional.id));
      professionalSelect.innerHTML='<option value="">A definir</option>'+eligible.map(professional=>'<option value="'+professional.id+
'">'+esc(professional.name)+
'</option>').join("");
      professionalSelect.disabled=!serviceId;
    });
    host.addEventListener("input",async e=>{
      if(!current())return;
      if(e.target.id!=="quote-customer-search")return;
      const term=e.target.value.trim().toLocaleLowerCase("pt-BR"),box=host.querySelector("#quote-customer-results");
      if(term.length<2){box.innerHTML="";return;}
      const matches=customers.filter(c=>(c.name+
" "+(c.phone||"")).toLocaleLowerCase("pt-BR").includes(term)).slice(0,8);
      box.innerHTML=matches.length?matches.map(c=>'<button type="button" class="quote-suggestion" data-select-customer="'+c.id+
'"><b>'+esc(c.name)+
'</b><small>'+esc(c.phone||"WhatsApp não informado")+
'</small></button>').join(""):'<div class="quote-not-found">Cliente não encontrado <button class="btn secondary" type="button" id="quote-show-quick">＋ Cadastrar cliente</button></div>';
    });
    host.addEventListener("click",async e=>{
      if(!current())return;
      const select=e.target.closest("[data-select-customer]");
      if(select){selectedCustomer=customers.find(c=>c.id===select.dataset.selectCustomer)||null;renderBuilder();return;}
      if(e.target.closest("#quote-show-quick")){host.querySelector("#quote-quick-customer").hidden=false;host.querySelector("#quote-quick-customer-form [name=name]").focus();return;}
      if(e.target.closest("#quote-quick-cancel")){host.querySelector("#quote-quick-customer").hidden=true;return;}
      if(e.target.closest("#quote-save")){
        if(!selectedCustomer||!items.length){toast("Selecione um cliente e adicione ao menos um serviço.");return;}
        const button=host.querySelector("#quote-save");button.disabled=true;button.textContent="Salvando orçamento…";
        try{
          const notes=host.querySelector("#quote-notes").value.trim(),validUntil=host.querySelector("#quote-valid-until").value||null;
          const payload=makeQuotePayload(items);
          calculateQuoteTotals(items);
          const {data:quote,error}=await supabase.rpc("create_quote_with_items",{
            p_org_id:orgId,p_branch_id:branchId,p_customer_id:selectedCustomer.id,
            p_valid_until:validUntil,p_notes:notes,p_items:payload
          });
          if(error)throw error;
          toast("Orçamento #"+quote.quote_number+
" gerado e marcado como Em análise.");
          await openQuote(quote.id,orgId);
        }catch(error){reportError(error,{context:"Orçamentos > gerar orçamento"});button.disabled=false;button.textContent="Gerar orçamento e deixar em análise";}
        return;
      }
      if(e.target.closest("#quote-add-item")){
        const service=services.find(s=>s.id===host.querySelector("#quote-service").value);
        if(!service){toast("Selecione um serviço válido.");return;}
        try{
          if(items.length>=100)throw new Error("O orçamento permite até 100 serviços.");
          const professionalId=host.querySelector("#quote-professional").value;
          const professional=professionals.find(p=>p.id===professionalId)||null;
          if(professionalId&&!professional)throw new Error("Selecione um profissional válido.");
          const item=buildQuoteItem({service,professional,assignments:professionalServices,
            quantity:host.querySelector("#quote-quantity").value,
            discountMode:host.querySelector("#quote-discount-mode").value,
            discountValue:host.querySelector("#quote-discount").value,
            maxDiscount,allowFixedDiscount,discountAllowed:discountRules.has(service.id)});
          calculateQuoteTotals([...items,item]);
          items.push(item);
        }catch(error){toast(error.message);return;}
        renderBuilder();return;
      }
      const remove=e.target.closest("[data-remove-quote-item]");
      if(remove){items.splice(Number(remove.dataset.removeQuoteItem),1);renderBuilder();return;}
      const open=e.target.closest("[data-open-quote]");
      if(open){await openQuote(open.dataset.openQuote,orgId);return;}
      const status=e.target.closest("[data-quote-status]");
      if(status){await changeQuoteStatus(status.dataset.quoteId,status.dataset.quoteStatus,orgId);return;}
      if(e.target.closest("#quote-schedule")){await openQuoteSchedule({quote:activeQuote,orgId,supabase,host,esc,toast,reportError,loadQuotesPage,openQuote});return;}
      if(e.target.closest("#quote-print")){await printQuoteDocument({quote:activeQuote,orgId,supabase,state,esc,money,statusName,toast});return;}
      if(e.target.closest("#quote-whatsapp")){const phone=activeQuote?.customer?.phone||"";if(!phone){toast("Cadastre o WhatsApp do cliente para compartilhar.");return;}let digits=phone.replace(/\D/g,"");if(digits.length===10||digits.length===11)digits="55"+digits;window.open("https://wa.me/"+digits+
"?text="+encodeURIComponent("Olá! Seu orçamento do "+(state.organization?.name||"salão")+
" está pronto. Vou anexar o PDF nesta conversa."),"_blank","noopener");return;}
      if(e.target.closest("#quote-back")){activeQuote=null;renderBuilder();renderList(quoteResult.data||[],new Map(customers.map(c=>[c.id,c.name])));return;}
    });
    host.addEventListener("submit",async e=>{
      if(!current())return;
      if(e.target.id==="quote-quick-customer-form"){
        e.preventDefault();const form=e.target,v=new FormData(form),name=String(v.get("name")||"").trim(),phone=String(v.get("phone")||"").trim();
        if(!name||!phone){toast("Informe nome e WhatsApp.");return;}
        const button=form.querySelector('[type=submit]');button.disabled=true;
        try{const {data,error}=await supabase.from("customers").insert({org_id:orgId,branch_id:state.branch?.id||null,name,phone}).select("id,name,phone").single();if(error)throw error;customers.push(data);selectedCustomer=data;toast("Cliente cadastrado e vinculado ao orçamento.");renderBuilder();}
        catch(error){reportError(error,{context:"Orçamentos > cadastro rápido"});}finally{button.disabled=false;}
      }
      if(e.target.id==="quote-discount-settings"){
        e.preventDefault();const form=e.target,percent=Number(new FormData(form).get("max_discount_percent"));
        if(host.dataset.discountRulesComplete!=="true"){toast("O catálogo de regras está incompleto. Não foi possível salvar com segurança.");return;}
        if(!Number.isFinite(percent)||percent<0||percent>100||Number(percent.toFixed(2))!==percent){toast("Informe um limite entre 0 e 100%.");return;}
        const selected=[...form.querySelectorAll('[name="discount_service"]:checked')].map(el=>el.value),fixedAllowed=form.querySelector('[name="allow_fixed_discount"]').checked;
        try{
          const {error}=await supabase.rpc("save_quote_discount_settings",{
            p_org_id:orgId,p_max_discount_percent:percent,p_allow_fixed_discount:fixedAllowed,p_service_ids:selected
          });
          if(error)throw error;
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
  host.innerHTML='<section class="settings-card quote-preview"><div class="section-title"><div><small class="eyebrow">SALÃO PREMIUM · PROPOSTA COMERCIAL</small><h2>Orçamento #'+activeQuote.quote_number+
'</h2><small class="muted">'+esc(statusName(activeQuote.status))+
' · '+new Date(activeQuote.created_at).toLocaleDateString("pt-BR")+
'</small></div><span class="status">'+esc(statusName(activeQuote.status))+
'</span></div><h3>Cliente: '+esc(activeQuote.customer?.name||"Cliente")+
'</h3><div class="record-list">'+activeQuote.items.map(i=>'<div class="setting-row"><span><b>'+esc(i.description)+
'</b><small>'+i.quantity+
' × '+money(i.unit_price)+
' · '+Number(i.duration_minutes)+
' min · '+esc(i.professionalName)+
'</small></span><span class="record-trailing"><b>'+money(i.total)+
'</b>'+(i.discount_amount?'<small>Desconto '+money(i.discount_amount)+
'</small>':'')+
'</span></div>').join("")+
'</div><div class="quote-totals"><div class="setting-row"><span>Subtotal</span><b>'+money(activeQuote.subtotal)+
'</b></div><div class="setting-row"><span>Desconto</span><b>− '+money(activeQuote.discount_total)+
'</b></div><div class="setting-row quote-grand-total"><b>Valor final</b><strong>'+money(activeQuote.total)+
'</strong></div></div><p class="muted">'+esc(activeQuote.notes||"")+
'</p><div class="quote-actions"><button class="btn secondary" id="quote-back">Voltar</button><button class="btn secondary" id="quote-print">Gerar PDF / Imprimir</button><button class="btn secondary" id="quote-whatsapp">Abrir WhatsApp (anexar PDF)</button>'+(activeQuote.status==="pending"?'<button class="btn primary" data-quote-status="accepted" data-quote-id="'+id+
'">Marcar como aceito</button><button class="btn secondary" data-quote-status="rejected" data-quote-id="'+id+
'">Marcar como recusado</button>':"")+(activeQuote.status==="accepted"?'<button class="btn primary" id="quote-schedule" data-quote-id="'+id+
'">Agendar horários</button><button class="btn secondary" data-quote-status="cancelled" data-quote-id="'+id+
'">Cancelar orçamento</button>':"")+
'</div></section>';
}
