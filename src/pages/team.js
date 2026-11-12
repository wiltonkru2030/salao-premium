import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, toast } from "../utils.js";
import { reportError } from "../utils/errors.js";

const roleLabel=role=>({owner:"Proprietário",admin:"Administrador",manager:"Gerente",receptionist:"Recepção",professional:"Profissional",finance:"Financeiro",viewer:"Consulta"})[role]||role;
export function teamPage(){
 return head("Equipe e permissões","Gerencie os usuários do salão e os acessos autorizados ao App Profissional.")+
  '<div id="team-manager"><div class="empty-state">Carregando equipe…</div></div>';
}
export async function loadTeamPage(){
 const host=document.querySelector("#team-manager");if(!host||!state.organization?.id)return;
 try{
  const {data:members,error}=await supabase.from("org_memberships")
   .select("user_id,role,status,professional_app_enabled,professional_app_scope,created_at")
   .eq("org_id",state.organization.id).order("created_at");
  if(error)throw error;
  const ids=[...new Set((members||[]).map(m=>m.user_id))];
  const {data:profiles,error:profileError}=ids.length
   ?await supabase.from("profiles").select("id,full_name,phone").in("id",ids)
   :{data:[],error:null};
  if(profileError)throw profileError;
  const profileMap=new Map((profiles||[]).map(p=>[p.id,p]));
  host.innerHTML=`
   <div class="list-toolbar"><span class="result-count">${members?.length||0} usuário(s) vinculados</span></div>
   <div class="record-list">${(members||[]).map(m=>{
    const profile=profileMap.get(m.user_id)||{},access=m.professional_app_enabled===true;
    const full=m.professional_app_scope==="calendar_all",reception=m.role==="receptionist";
    const accessLabel=access&&full?"App Profissional · Agenda completa":access?"App Profissional · Acesso individual":"App Profissional · Sem acesso";
    const actionLabel=access&&full?"Revogar acesso":"Liberar agenda completa";
    return '<article class="record-card"><span class="record-main"><b>'+esc(profile.full_name||"Usuário sem nome")+'</b><small>'+esc(roleLabel(m.role))+' · '+esc(m.status)+'</small><small>'+esc(profile.phone||"Conta vinculada")+'</small></span><span class="record-trailing">'+
      (m.role==="owner"||m.role==="admin"?'<small>Acesso completo automático</small>':
       reception?'<small>'+accessLabel+'</small><button class="btn '+(access&&full?"secondary":"primary")+'" data-reception-access="'+m.user_id+'" data-enabled="'+(access&&full?"true":"false")+'">'+actionLabel+'</button>':
       m.role==="professional"?'<small>Acesso vinculado ao cadastro profissional</small>':'<small>Sem permissão para o App Profissional</small>')+
     '</span></article>';
   }).join("")||'<div class="empty-state">Nenhum usuário vinculado ao salão.</div>'}</div>
   <p class="demo-note">A recepção liberada pode consultar a agenda de todos os profissionais e os dados necessários ao atendimento. Comissões individuais e dados financeiros gerais continuam restritos.</p>`;
  if(host.dataset.bound!=="true"){
   host.dataset.bound="true";
   host.addEventListener("click",async event=>{
    const button=event.target.closest("[data-reception-access]");if(!button)return;
    const currentlyEnabled=button.dataset.enabled==="true";
    button.disabled=true;button.textContent="Atualizando…";
    try {
     const {data,error}=await supabase.rpc("set_professional_app_access",{
      p_target_user_id:button.dataset.receptionAccess,
      p_enabled:!currentlyEnabled,
      p_scope:"calendar_all"
     });
     if(error)throw error;
     toast(data?.enabled?"Agenda completa liberada para a recepção.":"Acesso ao App Profissional revogado.");
     await loadTeamPage();
    } catch(error) {
     reportError(error,{context:"Equipe > alterar permissão da recepção"});
     button.disabled=false;button.textContent=currentlyEnabled?"Revogar acesso":"Liberar agenda completa";
    }
   });
  }
 }catch(error){
  reportError(error,{context:"Equipe > carregar usuários"});
  host.innerHTML='<div class="empty-state"><b>Não foi possível carregar a equipe.</b><small>Atualize a página e tente novamente.</small></div>';
 }
}
