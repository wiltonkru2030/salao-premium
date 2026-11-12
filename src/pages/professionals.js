import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, toast, esc } from "../utils.js";

const initialPasswords=new Map();
export function professionalsPage(){
 return head("Profissionais","Cadastre profissionais e gerencie o acesso individual por CPF ao App Profissional.")+
  '<p class="demo-note"><a href="../professional/index.html" target="_blank" rel="noopener">Abrir App Profissional ↗</a></p>'+
  '<div id="professionals-access"><div class="empty-state">Carregando profissionais…</div></div>';
}
export async function loadProfessionalsPage(){
 const host=document.querySelector("#professionals-access");
 if(!host||!state.organization?.id)return;
 const {data,error}=await supabase.from("professionals")
  .select("id,name,phone,email,active,access_enabled,commission_rate")
  .eq("org_id",state.organization.id).order("name");
 if(error){host.innerHTML='<div class="empty-state">Não foi possível carregar os profissionais.</div>';return;}
 host.innerHTML=`
 <details class="settings-card" open><summary><b>＋ Novo profissional</b></summary>
 <form id="professional-create-form" class="settings-form">
  <label>Nome completo<input class="field" name="name" required maxlength="120" placeholder="Nome do profissional"></label>
  <label>Telefone<input class="field" name="phone" type="tel" placeholder="(00) 00000-0000"></label>
  <label>E-mail (opcional)<input class="field" name="email" type="email" placeholder="profissional@email.com"></label>
  <label>Comissão padrão (%)<input class="field" name="commission_rate" type="number" min="0" max="100" step="0.01" value="0"></label>
  <button class="btn primary" type="submit">Cadastrar profissional</button>
 </form></details>
 <div class="list-toolbar"><span class="result-count">${data?.length||0} profissionais</span></div>
 <div class="record-list">${(data||[]).map(p=>`
 <article class="record-card professional-access-card" data-professional-card="${p.id}">
  <span class="record-main"><b>${esc(p.name)}</b><small>${esc(p.phone||p.email||"Sem contato")}</small><small>${p.active?"Cadastro ativo":"Cadastro inativo"} · Comissão: ${Number(p.commission_rate||0)}%</small>
   <label class="field">CPF<input class="field" data-professional-cpf="${p.id}" inputmode="numeric" maxlength="14" placeholder="000.000.000-00" autocomplete="off"></label>
   <label class="field">Senha inicial<input class="field" type="password" data-initial-password="${p.id}" value="${esc(initialPasswords.get(p.id)||"")}" placeholder="••••••••••" readonly></label>
  </span>
  <span class="record-trailing"><label class="access-toggle"><input type="checkbox" data-professional-toggle="${p.id}" ${p.access_enabled?"checked":""} ${!p.active?"disabled":""}><span>Permitir acesso ao App Profissional</span></label>
   <button type="button" class="btn secondary" data-professional-reset="${p.id}" ${!p.access_enabled?"disabled":""}>Redefinir senha</button>
   <button type="button" class="btn secondary" data-professional-copy="${p.id}" ${!initialPasswords.has(p.id)?"disabled":""}>Copiar senha inicial</button>
  </span>
 </article>`).join("")||'<div class="empty-state">Cadastre um profissional antes de liberar o App Profissional.</div>'}</div>
 <p class="demo-note">O CPF é usado para gerar uma identificação HMAC no servidor; ele não é salvo em texto puro. A senha temporária aparece uma única vez e deve ser entregue por um canal seguro. No primeiro login, o profissional cria sua própria senha.</p>`;
 if(host.dataset.bound==="true")return;
 host.dataset.bound="true";
 host.addEventListener("submit",async event=>{
  if(!event.target.matches("#professional-create-form"))return;
  event.preventDefault();
  const v=new FormData(event.target),name=String(v.get("name")||"").trim(),phone=String(v.get("phone")||"").trim(),email=String(v.get("email")||"").trim(),rate=Number(v.get("commission_rate")||0);
  if(!name||!Number.isFinite(rate)||rate<0||rate>100){toast("Confira o nome e a comissão informada.");return;}
  const {error}=await supabase.from("professionals").insert({org_id:state.organization.id,name,phone:phone||null,email:email||null,commission_rate:rate,active:true});
  if(error){toast("Não foi possível cadastrar o profissional: "+error.message);return;}
  toast("Profissional cadastrado.");await loadProfessionalsPage();
 });
 async function provision(button,action){
  const id=button.dataset.professionalReset||button.dataset.professionalToggle;
  const card=host.querySelector('[data-professional-card="'+id+'"]');
  const cpf=String(card?.querySelector('[data-professional-cpf="'+id+'"]')?.value||"").trim();
  if(!cpf){toast("Informe o CPF do profissional.");return false;}
  button.disabled=true;
  const {data,error}=await supabase.functions.invoke("manage-professional-access",{body:{
   action,org_id:state.organization.id,professional_id:id,cpf
  }});
  button.disabled=false;
  if(error||!data?.success){toast(data?.error||"Não foi possível criar o acesso.");return false;}
  if(data.temporary_password)initialPasswords.set(id,data.temporary_password);
  toast(action==="reset"?"Senha temporária redefinida.":"Acesso ao App Profissional liberado.");
  await loadProfessionalsPage();
  const target=host.querySelector('[data-professional-card="'+id+'"]');
  if(target&&data.temporary_password){
   const pass=target.querySelector('[data-initial-password="'+id+'"]');if(pass)pass.value=data.temporary_password;
   const copy=target.querySelector('[data-professional-copy="'+id+'"]');if(copy)copy.disabled=false;
   window.alert("Senha temporária de "+data.professional_name+":\n"+data.temporary_password+"\n\nEntregue ao profissional por um canal seguro. Ela será solicitada apenas neste primeiro acesso.");
  }
  return true;
 }
 host.addEventListener("change",async event=>{
  const toggle=event.target.closest("[data-professional-toggle]");if(!toggle)return;
  const id=toggle.dataset.professionalToggle;
  if(toggle.checked){
   const ok=await provision(toggle,"create");
   if(!ok)toggle.checked=false;
  }else{
   toggle.disabled=true;
   const {error}=await supabase.rpc("revoke_professional_app_access",{p_professional_id:id});
   toggle.disabled=false;
   if(error){toast(error.message||"Não foi possível revogar o acesso.");toggle.checked=true;return;}
   initialPasswords.delete(id);toast("Acesso ao App Profissional revogado.");await loadProfessionalsPage();
  }
 });
 host.addEventListener("click",async event=>{
  const reset=event.target.closest("[data-professional-reset]");
  if(reset){if(!window.confirm("Gerar uma nova senha temporária para este profissional?"))return;await provision(reset,"reset");return;}
  const copy=event.target.closest("[data-professional-copy]");
  if(copy){const id=copy.dataset.professionalCopy,password=initialPasswords.get(id);if(!password)return;await navigator.clipboard.writeText(password);toast("Senha inicial copiada.");}
 });
}
