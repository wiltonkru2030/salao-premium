import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, toast, esc } from "../utils.js";
export function professionalsPage() {
  return head("Profissionais","Gerencie sua equipe e libere o acesso individual ao App Profissional.") + '<p class="demo-note"><a href="../professional/index.html" target="_blank" rel="noopener">Abrir App Profissional ↗</a></p>' +
    '<div id="professionals-access"><div class="empty-state">Carregando profissionais…</div></div>';
}
export async function loadProfessionalsPage() {
  const host=document.querySelector("#professionals-access");
  if(!host||!state.organization?.id)return;
  const {data,error}=await supabase.from("professionals").select("id,name,phone,email,active,access_enabled").eq("org_id",state.organization.id).order("name");
  if(error){host.innerHTML='<div class="empty-state">Não foi possível carregar os profissionais.</div>';return;}
  host.innerHTML=(data||[]).map(p=>`
    <article class="record-card">
      <span class="record-main"><b>${esc(p.name)}</b><small>${esc(p.phone||p.email||"Sem contato")}</small><small>${p.active?"Cadastro ativo":"Cadastro inativo"}</small></span>
      <span class="record-trailing"><small>${p.access_enabled?"Acesso liberado":"Sem acesso"}</small><button class="btn ${p.access_enabled?"secondary":"primary"}" data-professional-access="${p.id}" data-mode="${p.access_enabled?"reset":"create"}">${p.access_enabled?"Redefinir senha":"Criar acesso"}</button></span>
    </article>`).join("")||'<div class="empty-state">Cadastre um profissional antes de liberar o acesso.</div>';
  if(host.dataset.bound==="true")return;
  host.dataset.bound="true";
  host.addEventListener("click",async event=>{
    const button=event.target.closest("[data-professional-access]");if(!button)return;
    const cpf=window.prompt("Informe o CPF do profissional (somente para vincular o acesso):");if(!cpf)return;
    button.disabled=true;button.textContent="Processando…";
    const {data,error}=await supabase.functions.invoke("manage-professional-access",{body:{action:button.dataset.mode,org_id:state.organization.id,professional_id:button.dataset.professionalAccess,cpf}});
    if(error||!data?.success){toast(data?.error||"A função segura de acesso profissional ainda não está publicada.");button.disabled=false;button.textContent=button.dataset.mode==="reset"?"Redefinir senha":"Criar acesso";return;}
    window.alert("Acesso de "+data.professional_name+"\nSenha temporária (exibida uma única vez):\n"+data.temporary_password+"\n\nEntregue por um canal seguro e solicite a troca.");
    toast("Acesso profissional atualizado.");await loadProfessionalsPage();
  });
}