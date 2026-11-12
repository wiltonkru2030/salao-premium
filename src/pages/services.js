import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, toast, btn } from "../utils.js";
import { parseBRL } from "../utils/input-masks.js";
const money=value=>Number(value||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export function servicesPage(){
 return head("Serviços","Cadastre os serviços que aparecem na agenda, nas comandas e no App Profissional.",btn("＋ Novo serviço","open-service-modal","primary"))+
 '<div id="services-manager"><div class="empty-state">Carregando serviços…</div></div>';
}
export async function loadServicesPage(){
 const host=document.querySelector("#services-manager");if(!host||!state.organization?.id)return;
 const {data,error}=await supabase.from("services").select("id,name,category,duration_minutes,price,active").eq("org_id",state.organization.id).order("name").limit(500);
 if(error){host.innerHTML='<div class="empty-state">Não foi possível carregar os serviços.</div>';return;}
 host.innerHTML=`
 <dialog class="sp-modal" id="service-create-modal" aria-labelledby="service-modal-title"><div class="sp-modal-shell">
  <header class="sp-modal-head"><div><h2 id="service-modal-title">Novo serviço</h2><p>Defina o serviço, a categoria, a duração e o preço.</p></div><button class="sp-modal-close" type="button" data-close-service-modal aria-label="Fechar">×</button></header>
  <form id="service-create-form"><div class="sp-modal-body">
   <label class="sp-span">Nome do serviço<input name="name" required maxlength="120" placeholder="Ex.: Corte feminino"></label>
   <label>Categoria<input name="category" placeholder="Cabelo, unhas, estética…"></label>
   <label>Duração (minutos)<input name="duration" type="number" min="5" max="720" step="5" value="30" required></label>
   <label>Preço (R$)<input name="price" type="text" inputmode="decimal" data-mask="currency" value="0,00" required></label>
   <label class="sp-span">Descrição<textarea name="description" rows="3" placeholder="Detalhes opcionais do serviço"></textarea></label>
  </div><footer class="sp-modal-foot"><button class="btn secondary" type="button" data-close-service-modal>Cancelar</button><button class="btn primary" type="submit">Cadastrar serviço</button></footer></form>
 </div></dialog>
 <div class="list-toolbar"><span class="result-count">${data?.length||0} serviços</span></div>
 <div class="record-list">${(data||[]).map(s=>`<article class="record-card"><span class="record-main"><b>${esc(s.name)}</b><small>${esc(s.category||"Sem categoria")} · ${Number(s.duration_minutes)} min</small></span><span class="record-trailing"><b>${money(s.price)}</b><small>${s.active?"Ativo":"Inativo"}</small></span></article>`).join("")||'<div class="empty-state">Nenhum serviço cadastrado.</div>'}</div>`;
 if(host.dataset.bound==="true")return;host.dataset.bound="true";
 host.addEventListener("click",event=>{
  if(event.target.closest('[data-action="open-service-modal"]'))host.querySelector("#service-create-modal")?.showModal();
  if(event.target.closest("[data-close-service-modal]"))host.querySelector("#service-create-modal")?.close();
 });
 host.addEventListener("submit",async event=>{
  if(!event.target.matches("#service-create-form"))return;event.preventDefault();
  const form=event.target,v=new FormData(form),name=String(v.get("name")||"").trim(),duration=Number(v.get("duration")),price=parseBRL(v.get("price")),submit=form.querySelector('[type="submit"]');
  if(!name||!Number.isFinite(duration)||duration<5||!Number.isFinite(price)||price<0){toast("Confira o nome, duração e preço.");return;}
  submit.disabled=true;
  const {error}=await supabase.from("services").insert({org_id:state.organization.id,name,category:String(v.get("category")||"").trim()||null,duration_minutes:duration,price,description:String(v.get("description")||"").trim()||null,active:true});
  submit.disabled=false;
  if(error){toast("Não foi possível cadastrar o serviço: "+error.message);return;}
  host.querySelector("#service-create-modal")?.close();toast("Serviço cadastrado.");await loadServicesPage();
 });
}
