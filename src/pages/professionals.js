import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, toast, esc } from "../utils.js";

export function professionalsPage() {
  return head("Profissionais","Cadastre sua equipe e gerencie o acesso individual ao App Profissional.") +
    '<p class="demo-note"><a href="../professional/index.html" target="_blank" rel="noopener">Abrir App Profissional ↗</a></p>' +
    '<div id="professionals-access"><div class="empty-state">Carregando profissionais…</div></div>';
}
export async function loadProfessionalsPage() {
  const host=document.querySelector("#professionals-access");
  if(!host||!state.organization?.id)return;
  const {data,error}=await supabase.from("professionals")
    .select("id,name,phone,email,active,access_enabled,commission_rate")
    .eq("org_id",state.organization.id).order("name");
  if(error){host.innerHTML='<div class="empty-state">Não foi possível carregar os profissionais.</div>';return;}
  host.innerHTML=`
    <details class="settings-card" open>
      <summary><b>＋ Novo profissional</b></summary>
      <form id="professional-create-form" class="settings-form">
        <label>Nome completo<input class="field" name="name" required maxlength="120" placeholder="Nome do profissional"></label>
        <label>Telefone<input class="field" name="phone" type="tel" placeholder="(00) 00000-0000"></label>
        <label>E-mail (opcional)<input class="field" name="email" type="email" placeholder="profissional@email.com"></label>
        <label>Comissão padrão (%)<input class="field" name="commission_rate" type="number" min="0" max="100" step="0.01" value="0"></label>
        <button class="btn primary" type="submit">Cadastrar profissional</button>
      </form>
    </details>
    <div class="list-toolbar"><span class="result-count">${data?.length||0} profissionais</span></div>
    <div class="record-list">${(data||[]).map(p=>`
      <article class="record-card">
        <span class="record-main"><b>${esc(p.name)}</b><small>${esc(p.phone||p.email||"Sem contato")}</small><small>${p.active?"Cadastro ativo":"Cadastro inativo"} · Comissão: ${Number(p.commission_rate||0)}%</small></span>
        <span class="record-trailing"><small>${p.access_enabled?"Acesso liberado":"Sem acesso"}</small><button class="btn ${p.access_enabled?"secondary":"primary"}" data-professional-access="${p.id}" data-mode="${p.access_enabled?"reset":"create"}">${p.access_enabled?"Redefinir senha":"Criar acesso"}</button></span>
      </article>`).join("")||'<div class="empty-state">Cadastre o primeiro profissional para liberar o App Profissional.</div>'}</div>`;
  if(host.dataset.bound==="true")return;
  host.dataset.bound="true";
  host.addEventListener("submit",async event=>{
    if(!event.target.matches("#professional-create-form"))return;
    event.preventDefault();
    const values=new FormData(event.target),name=String(values.get("name")||"").trim(),phone=String(values.get("phone")||"").trim(),email=String(values.get("email")||"").trim(),rate=Number(values.get("commission_rate")||0);
    if(!name||!Number.isFinite(rate)||rate<0||rate>100){toast("Confira o nome e a comissão informada.");return;}
    const {error}=await supabase.from("professionals").insert({org_id:state.organization.id,name,phone:phone||null,email:email||null,commission_rate:rate,active:true});
    if(error){toast("Não foi possível cadastrar o profissional: "+error.message);return;}
    toast("Profissional cadastrado.");await loadProfessionalsPage();
  });
  host.addEventListener("click",async event=>{
    const button=event.target.closest("[data-professional-access]");if(!button)return;
    const cpf=window.prompt("Informe o CPF do profissional (somente para vincular o acesso):");if(!cpf)return;
    button.disabled=true;button.textContent="Processando…";
    const {data:result,error:fnError}=await supabase.functions.invoke("manage-professional-access",{body:{
      action:button.dataset.mode,org_id:state.organization.id,professional_id:button.dataset.professionalAccess,cpf
    }});
    if(fnError||!result?.success){toast(result?.error||"Não foi possível criar ou redefinir o acesso.");button.disabled=false;button.textContent=button.dataset.mode==="reset"?"Redefinir senha":"Criar acesso";return;}
    window.alert("Acesso de "+result.professional_name+"\nSenha temporária (exibida uma única vez):\n"+result.temporary_password+"\n\nEntregue por um canal seguro. No primeiro login, o profissional será obrigado a criar outra senha.");
    toast("Acesso profissional atualizado.");await loadProfessionalsPage();
  });
}
