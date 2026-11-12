import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, toast } from "../utils.js";
const money=value=>Number(value||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export function servicesPage(){
 return head("Serviços","Cadastre os serviços que aparecem na agenda, nas comandas e no App Profissional.")+
 '<div id="services-manager"><div class="empty-state">Carregando serviços…</div></div>';
}
export async function loadServicesPage(){
 const host=document.querySelector("#services-manager");if(!host||!state.organization?.id)return;
 const {data,error}=await supabase.from("services").select("id,name,category,duration_minutes,price,active").eq("org_id",state.organization.id).order("name").limit(500);
 if(error){host.innerHTML='<div class="empty-state">Não foi possível carregar os serviços.</div>';return;}
 host.innerHTML=`
 <details class="settings-card" open><summary><b>＋ Novo serviço</b></summary>
 <form id="service-create-form" class="settings-form">
  <label>Nome do serviço<input class="field" name="name" required maxlength="120" placeholder="Ex.: Corte feminino"></label>
  <label>Categoria<input class="field" name="category" placeholder="Cabelo, unhas, estética…"></label>
  <label>Duração (minutos)<input class="field" name="duration" type="number" min="5" max="720" step="5" value="30" required></label>
  <label>Preço (R$)<input class="field" name="price" type="number" min="0" step="0.01" value="0" required></label>
  <label>Descrição<textarea name="description" rows="2"></textarea></label>
  <button class="btn primary" type="submit">Cadastrar serviço</button>
 </form></details>
 <div class="list-toolbar"><span class="result-count">${data?.length||0} serviços</span></div>
 <div class="record-list">${(data||[]).map(s=>`<article class="record-card"><span class="record-main"><b>${esc(s.name)}</b><small>${esc(s.category||"Sem categoria")} · ${Number(s.duration_minutes)} min</small></span><span class="record-trailing"><b>${money(s.price)}</b><small>${s.active?"Ativo":"Inativo"}</small></span></article>`).join("")||'<div class="empty-state">Nenhum serviço cadastrado.</div>'}</div>`;
 if(host.dataset.bound==="true")return;host.dataset.bound="true";
 host.addEventListener("submit",async event=>{
  if(!event.target.matches("#service-create-form"))return;event.preventDefault();
  const v=new FormData(event.target),name=String(v.get("name")||"").trim(),duration=Number(v.get("duration")),price=Number(v.get("price"));
  if(!name||!Number.isFinite(duration)||duration<5||!Number.isFinite(price)||price<0){toast("Confira o nome, duração e preço.");return;}
  const {error}=await supabase.from("services").insert({org_id:state.organization.id,name,category:String(v.get("category")||"").trim()||null,duration_minutes:duration,price,description:String(v.get("description")||"").trim()||null,active:true});
  if(error){toast("Não foi possível cadastrar o serviço: "+error.message);return;}
  toast("Serviço cadastrado.");await loadServicesPage();
 });
}
