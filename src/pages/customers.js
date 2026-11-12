import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, toast } from "../utils.js";

export function customersPage(){
 return head("Clientes","Cadastre e mantenha os dados dos clientes em um único lugar.")+
 '<div id="customers-manager"><div class="empty-state">Carregando clientes…</div></div>';
}
export async function loadCustomersPage(){
 const host=document.querySelector("#customers-manager");if(!host||!state.organization?.id)return;
 const {data,error}=await supabase.from("customers").select("id,name,phone,email,birth_date,active").eq("org_id",state.organization.id).order("name").limit(500);
 if(error){host.innerHTML='<div class="empty-state">Não foi possível carregar os clientes.</div>';return;}
 host.innerHTML=`
 <details class="settings-card" open><summary><b>＋ Novo cliente</b></summary>
 <form id="customer-create-form" class="settings-form">
  <label>Nome completo<input class="field" name="name" required maxlength="120" placeholder="Nome do cliente"></label>
  <label>Telefone<input class="field" name="phone" type="tel" placeholder="(00) 00000-0000"></label>
  <label>E-mail<input class="field" name="email" type="email" placeholder="cliente@email.com"></label>
  <label>Data de nascimento<input class="field" name="birth_date" type="date"></label>
  <button class="btn primary" type="submit">Cadastrar cliente</button>
 </form></details>
 <div class="list-toolbar"><span class="result-count">${data?.length||0} clientes</span></div>
 <div class="record-list">${(data||[]).map(c=>`<article class="record-card"><span class="record-main"><b>${esc(c.name)}</b><small>${esc(c.phone||"Telefone não informado")}</small><small>${esc(c.email||"")}</small></span><span class="record-trailing"><small>${c.active?"Ativo":"Inativo"}</small></span></article>`).join("")||'<div class="empty-state">Nenhum cliente cadastrado.</div>'}</div>`;
 if(host.dataset.bound==="true")return;host.dataset.bound="true";
 host.addEventListener("submit",async event=>{
  if(!event.target.matches("#customer-create-form"))return;event.preventDefault();
  const values=new FormData(event.target),name=String(values.get("name")||"").trim();
  if(!name){toast("Informe o nome do cliente.");return;}
  const {error}=await supabase.from("customers").insert({org_id:state.organization.id,name,phone:String(values.get("phone")||"").trim()||null,email:String(values.get("email")||"").trim()||null,birth_date:String(values.get("birth_date")||"")||null});
  if(error){toast("Não foi possível cadastrar o cliente: "+error.message);return;}
  toast("Cliente cadastrado.");await loadCustomersPage();
 });
}
