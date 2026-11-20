/**
 * Módulo: Cupons.
 * Responsabilidade: administrar cupons do tenant com validade, escopo por filial/serviço e limites de uso.
 * Persistência: RPC transacional save_salon_coupon; desativação preserva o histórico de resgates.
 * Segurança: somente owner/admin pode consultar e alterar cupons; RLS/RPC são a barreira final.
 */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, toast, btn } from "../utils.js";
import { listCoupons, buildCouponPayload, saveCoupon, deactivateCoupon, formatCouponDiscount, toCouponDateTimeInput } from "../modules/coupons/coupon.service.js";
import { reportError } from "../utils/errors.js";

let coupons = [];
let services = [];
let branches = [];
let listenersInstalled = false;

const canManageCoupons = () => ["owner","admin"].includes(state.membership?.role);
const dateTime = value => value ? new Date(value).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}) : "—";

/** Renderiza a página de cupons sem mostrar dados fictícios. */
export function couponsPage() {
  return head("Cupons","Crie campanhas de desconto e limite por unidade, serviço, validade e utilização.",
    canManageCoupons()?btn("＋ Novo cupom","open-coupon-modal","primary"):"")+
    '<div id="coupons-manager"><div class="empty-state">Carregando cupons do banco…</div></div>';
}

/** Preenche e abre o modal de cadastro/edição com os dados persistidos. */
function openCouponModal(coupon=null) {
  const dialog=document.querySelector("#coupon-create-modal");
  const form=dialog?.querySelector("#coupon-create-form");
  if(!dialog||!form)return;
  form.reset();
  form.elements.coupon_id.value=coupon?.id||"";
  form.elements.code.value=coupon?.code||"";
  form.elements.title.value=coupon?.title||"";
  form.elements.description.value=coupon?.description||"";
  form.elements.branch_id.value=coupon?.branch_id||"";
  form.elements.discount_type.value=coupon?.discount_type||"percent";
  form.elements.discount_value.value=String(coupon?.discount_value??"");
  form.elements.max_discount_amount.value=coupon?.max_discount_amount??"";
  form.elements.minimum_amount.value=coupon?.minimum_amount??"0";
  form.elements.starts_at.value=toCouponDateTimeInput(coupon?.starts_at||new Date());
  form.elements.ends_at.value=toCouponDateTimeInput(coupon?.ends_at||new Date(Date.now()+30*86400000));
  form.elements.usage_limit.value=coupon?.usage_limit??"";
  form.elements.usage_per_customer.value=coupon?.usage_per_customer??1;
  form.elements.active.checked=Boolean(coupon?.active);
  const selected=new Set(coupon?.serviceIds||[]);
  form.querySelectorAll('input[name="service_ids"]').forEach(input=>{input.checked=selected.has(input.value);});
  const title=dialog.querySelector("#coupon-modal-title");
  if(title)title.textContent=coupon?"Editar cupom":"Novo cupom";
  if(!dialog.open)dialog.showModal();
}

/** Carrega cupons, serviços, unidades e contagem de resgates do tenant atual. */
export async function loadCouponsPage() {
  const host=document.querySelector("#coupons-manager");
  if(!host||!state.organization?.id)return;
  if(!canManageCoupons()){
    host.innerHTML='<div class="empty-state">Somente proprietário ou administrador pode gerenciar cupons.</div>';
    return;
  }
  try {
    const orgId=state.organization.id;
    const result=await listCoupons({client:supabase,orgId});
    coupons=result.coupons;
    services=result.services;
    branches=result.branches;
    const serviceMap=new Map(services.map(row=>[row.id,row.name]));
    const branchMap=new Map(branches.map(row=>[row.id,row.name]));
    const usedByCoupon=new Map();
    result.redemptions.filter(row=>row.status==="redeemed").forEach(row=>usedByCoupon.set(row.coupon_id,(usedByCoupon.get(row.coupon_id)||0)+1));

    host.innerHTML=`
      <dialog class="sp-modal" id="coupon-create-modal" aria-labelledby="coupon-modal-title">
        <div class="sp-modal-shell">
          <header class="sp-modal-head"><div><h2 id="coupon-modal-title">Novo cupom</h2><p>Configure o desconto e as regras de utilização.</p></div>
            <button class="sp-modal-close" type="button" data-close-coupon-modal aria-label="Fechar">×</button></header>
          <form id="coupon-create-form">
            <input type="hidden" name="coupon_id">
            <div class="sp-modal-body">
              <label>Código<input name="code" required maxlength="32" pattern="[A-Za-z0-9_-]{3,32}" placeholder="BLACK20"></label>
              <label>Nome da campanha<input name="title" required maxlength="120" placeholder="Desconto de boas-vindas"></label>
              <label>Tipo de desconto<select name="discount_type"><option value="percent">Percentual (%)</option><option value="fixed">Valor fixo (R$)</option></select></label>
              <label>Desconto<input name="discount_value" required inputmode="decimal" data-mask="currency" placeholder="20,00"></label>
              <label>Desconto máximo (R$)<input name="max_discount_amount" inputmode="decimal" data-mask="currency" placeholder="Opcional"></label>
              <label>Valor mínimo (R$)<input name="minimum_amount" inputmode="decimal" data-mask="currency" value="0,00"></label>
              <label>Unidade<select name="branch_id"><option value="">Todas as unidades</option>${branches.map(row=>'<option value="'+esc(row.id)+'">'+esc(row.name)+'</option>').join("")}</select></label>
              <label>Limite total de usos<input name="usage_limit" type="number" min="1" step="1" placeholder="Sem limite"></label>
              <label>Usos por cliente<input name="usage_per_customer" type="number" min="1" step="1" value="1" required></label>
              <label>Início da validade<input name="starts_at" type="datetime-local" required></label>
              <label>Fim da validade<input name="ends_at" type="datetime-local" required></label>
              <label class="sp-span">Descrição pública<textarea name="description" rows="2" maxlength="500" placeholder="Condições do desconto"></textarea></label>
              <div class="sp-span coupon-service-scope"><b>Serviços elegíveis</b><small>Se nenhum serviço for marcado, o cupom vale para todos os serviços ativos.</small>
                <div class="coupon-service-grid">${services.map(row=>'<label><input type="checkbox" name="service_ids" value="'+esc(row.id)+'"> '+esc(row.name)+'</label>').join("")||'<small>Nenhum serviço ativo cadastrado.</small>'}</div>
              </div>
              <label class="public-check"><input type="checkbox" name="active"> Ativar cupom imediatamente</label>
            </div>
            <footer class="sp-modal-foot"><button class="btn secondary" type="button" data-close-coupon-modal>Cancelar</button><button class="btn primary" type="submit">Salvar cupom</button></footer>
          </form>
        </div>
      </dialog>
      <div class="list-toolbar"><span class="result-count">${coupons.length} cupons</span></div>
      <div class="coupon-record-list">${coupons.map(coupon=>{
        const used=usedByCoupon.get(coupon.id)||0;
        const scope=coupon.serviceIds.length?coupon.serviceIds.map(id=>serviceMap.get(id)).filter(Boolean).join(", "):"Todos os serviços";
        return '<article class="record-card coupon-record-card"><div class="record-main"><b>'+esc(coupon.code)+' · '+esc(coupon.title)+'</b><small>'+esc(formatCouponDiscount(coupon))+' · '+esc(branchMap.get(coupon.branch_id)||"Todas as unidades")+'</small><small>'+esc(scope)+'</small><small>Validade: '+esc(dateTime(coupon.starts_at))+' até '+esc(dateTime(coupon.ends_at))+'</small><small>Usos: '+used+(coupon.usage_limit?' / '+coupon.usage_limit:'')+' · '+(coupon.usage_per_customer||1)+' por cliente</small></div><div class="coupon-record-actions"><span class="status-pill '+(coupon.active?'active':'inactive')+'">'+(coupon.active?'Ativo':'Inativo')+'</span><button class="btn secondary" type="button" data-edit-coupon="'+esc(coupon.id)+'">Editar</button>'+(coupon.active?'<button class="text-button" type="button" data-deactivate-coupon="'+esc(coupon.id)+'">Desativar</button>':'')+'</div></article>';
      }).join("")||'<div class="empty-state">Nenhum cupom cadastrado.</div>'}</div>`;

    if(host.dataset.bound==="true")return;
    host.dataset.bound="true";
    if(!listenersInstalled){
      listenersInstalled=true;
      document.addEventListener("click",event=>{
        const dialog=document.querySelector("#coupon-create-modal");
        if(!dialog)return;
        if(event.target.closest('[data-action="open-coupon-modal"]')&&canManageCoupons())openCouponModal();
        else if(event.target.closest("[data-close-coupon-modal]")||event.target===dialog){if(dialog.open)dialog.close();}
      });
    }
    host.addEventListener("click",async event=>{
      const edit=event.target.closest("[data-edit-coupon]");
      if(edit){openCouponModal(coupons.find(row=>row.id===edit.dataset.editCoupon));return;}
      const deactivate=event.target.closest("[data-deactivate-coupon]");
      if(!deactivate)return;
      if(!canManageCoupons())return toast("Somente proprietário ou administrador pode desativar cupons.");
      deactivate.disabled=true;
      try{
        const changed=await deactivateCoupon({client:supabase,orgId,couponId:deactivate.dataset.deactivateCoupon});
        if(!changed)throw new Error("O cupom não foi encontrado.");
        toast("Cupom desativado. O histórico de resgates foi preservado.");
        await loadCouponsPage();
      }catch(error){reportError(error,{context:"Cupons > desativar"});}
      finally{if(deactivate.isConnected)deactivate.disabled=false;}
    });
    host.addEventListener("submit",async event=>{
      const form=event.target;
      if(!form.matches("#coupon-create-form"))return;
      event.preventDefault();
      if(!canManageCoupons())return toast("Somente proprietário ou administrador pode salvar cupons.");
      const values=new FormData(form);
      let payload;
      try {
        payload=buildCouponPayload(values,state.organization.id);
      } catch(validationError) {
        toast(validationError.message);
        return;
      }
      const submit=form.querySelector('[type="submit"]');
      submit.disabled=true;
      try{
        await saveCoupon({client:supabase,payload});
        document.querySelector("#coupon-create-modal")?.close();
        toast("Cupom salvo.");
        await loadCouponsPage();
      }catch(error){reportError(error,{context:"Cupons > salvar"});}
      finally{if(submit.isConnected)submit.disabled=false;}
    });
  }catch(error){
    reportError(error,{context:"Cupons > carregar"});
    host.innerHTML='<div class="empty-state">Não foi possível carregar os cupons. Confirme se a migration do módulo foi aplicada no ambiente de teste.</div>';
  }
}
