/**
 * Módulo: Equipe e permissões.
 * Responsabilidade: apresentar membros da organização e administrar acesso da recepção.
 * Integração: memberships controlam papéis e acesso ao App Profissional.
 * Segurança: o serviço usa org_id explícito e a RPC valida operador e usuário-alvo no banco.
 */
import {supabase} from "../supabase/client.js";
import {state} from "../state.js";
import {head,esc,toast} from "../utils.js";
import {reportError} from "../utils/errors.js";
import {fetchTeamWorkspace,fetchTeamBranches,setTeamBranchAssignment,setReceptionAppAccess} from "../modules/team/team.service.js";

/** A gestão de acessos é restrita ao proprietário/administrador, conforme o RPC. */
const canManageTeam=()=>["owner","admin"].includes(state.membership?.role);
const roleLabel=role=>({owner:"Proprietário",admin:"Administrador",manager:"Gerente",receptionist:"Recepção",professional:"Profissional",finance:"Financeiro",viewer:"Consulta"})[role]||role;

/** Renderiza a página de Equipe e permissões com estado inicial de carregamento. */
export function teamPage() {
  return head("Equipe e permissões","Gerencie os vínculos por unidade e o acesso ao App Profissional.")+
    '<div id="team-manager"><div class="empty-state">Carregando equipe…</div></div>';
}

/**
 * Consulta membros/perfis e instala ações delegadas uma única vez.
 * @returns {Promise<void>} Renderiza a equipe e trata erros de consulta.
 */
export async function loadTeamPage() {
  const host=document.querySelector("#team-manager");
  if(!host||!state.organization?.id)return;
  const orgId=state.organization.id,userId=state.user?.id,role=state.membership?.role;
  const request=String(Number(host.dataset.request||0)+1);host.dataset.request=request;
  // Mantém o resultado associado ao tenant e à página que iniciaram a consulta.
  const current=()=>host.isConnected&&state.page==='Equipe e permissões'&&state.organization?.id===orgId&&state.user?.id===userId&&state.membership?.role===role&&host.dataset.request===request;
  const managing = canManageTeam();
  const branchRequest = managing
    ? fetchTeamBranches({client:supabase,orgId}).catch(error => ({error}))
    : null;
  let members,profiles;
  try {
    ({members,profiles}=await fetchTeamWorkspace({client:supabase,orgId}));
    if(!current())return;
  } catch(error) {
    if(!current())return;
    reportError(error,{context:"Equipe > carregar usuários"});
    host.innerHTML='<div class="empty-state"><b>Não foi possível carregar a equipe.</b><small>Atualize a página e tente novamente.</small></div>';
    return;
  }
  const branchData = await branchRequest;
  if (!current()) return;
  const profileMap=new Map(profiles.map(profile=>[profile.id,profile]));
  const cards=members.map(member=>{
    const profile=profileMap.get(member.user_id)||{};
    const access=member.professional_app_enabled===true;
    const full=member.professional_app_scope==="calendar_all";
    const accessLabel=access&&full?"App Profissional · Agenda completa":access?"App Profissional · Acesso individual":"App Profissional · Sem acesso";
    const actionLabel=access&&full?"Revogar acesso":"Liberar agenda completa";
    const action=member.role==="receptionist"
      ? '<small>'+accessLabel+'</small><button class="btn '+(access&&full?"secondary":"primary")+'" type="button" data-reception-access="'+esc(member.user_id)+'" data-enabled="'+(access&&full?"true":"false")+'">'+actionLabel+'</button>'
      : member.role==="owner"||member.role==="admin"
        ? '<small>' + (access && member.professional_app_scope === "all"
          ? "App Profissional · Acesso completo" : accessLabel) + '</small>'
        : member.role==="professional"
          ? '<small>Acesso vinculado ao cadastro profissional</small>'
          : '<small>Sem permissão para o App Profissional</small>';
    const canAssign = managing && member.status === "active" && ["manager","receptionist"].includes(member.role);
    let units = "";
    if (canAssign && branchData?.branches?.length) {
      const assigned = new Set(branchData.assignments
        .filter(item => item.user_id === member.user_id).map(item => item.branch_id));
      const options = branchData.branches.map(branch =>
        '<label><input type="checkbox" data-team-unit="' + esc(branch.id) +
        '" data-team-member="' + esc(member.user_id) + '"' +
        (assigned.has(branch.id) ? ' checked' : '') + '> ' + esc(branch.name) + '</label>'
      ).join("");
      units = '<fieldset class="team-unit-options"><legend>Unidades de ' +
        esc(profile.full_name || "usuário sem nome") + '</legend>' + options + '</fieldset>';
    }
    return '<article class="record-card"><span class="record-main"><b>'+esc(profile.full_name||"Usuário sem nome")+'</b>'+
      '<small>'+esc(roleLabel(member.role))+' · '+esc(member.status)+'</small>'+
      '<small>'+esc(profile.phone||"Conta vinculada")+'</small></span><span class="record-trailing">'+action+units+'</span></article>';
  }).join("");
  host.innerHTML=
    '<div class="list-toolbar"><span class="result-count">'+members.length+' usuário(s) vinculados</span></div>'+
    '<div class="record-list">'+(cards||'<div class="empty-state">Nenhum usuário vinculado ao salão.</div>')+'</div>'+
    (branchData?.error ? '<p role="status">Não foi possível carregar as atribuições de unidade.</p>' : '')+
    (branchData?.branches && !branchData.branches.length ? '<p role="status">Nenhuma unidade ativa disponível para atribuição.</p>' : '')+
    '<p class="demo-note">A recepção liberada pode consultar a agenda de todos os profissionais e os dados necessários ao atendimento. Comissões individuais e dados financeiros gerais continuam restritos.</p>';

  if(host.dataset.bound==="true")return;
  host.dataset.bound="true";
  host.addEventListener("change", async event => {
    const input = event.target.closest("[data-team-unit]");
    if (!input || !canManageTeam()) return;
    const orgId = state.organization.id;
    const userId = state.user?.id;
    const assigned = input.checked;
    const fieldset = input.closest("fieldset");
    fieldset.disabled = true;
    try {
      await setTeamBranchAssignment({
        client: supabase, orgId, branchId: input.dataset.teamUnit,
        userId: input.dataset.teamMember, assigned
      });
      if (input.isConnected && state.organization?.id === orgId && state.user?.id === userId) {
        toast(assigned ? "Unidade atribuída." : "Atribuição revogada.");
      }
    } catch (error) {
      if (input.isConnected) {
        input.checked = !assigned;
        reportError(error, {context:"Equipe > atribuir unidade"});
      }
    } finally {
      fieldset.disabled = false;
    }
  });
  host.addEventListener("click",async event=>{
    const button=event.target.closest("[data-reception-access]");
    if(!button)return;
    if(!canManageTeam())return toast("Somente proprietário ou administrador pode alterar acessos.");
    const enabled=button.dataset.enabled!=="true";
    button.disabled=true;
    button.textContent="Atualizando…";
    try {
      const result=await setReceptionAppAccess({
        client:supabase,orgId:state.organization.id,
        userId:button.dataset.receptionAccess,enabled
      });
      toast(result.enabled?"Agenda completa liberada para a recepção.":"Acesso ao App Profissional revogado.");
      await loadTeamPage();
    } catch(error) {
      reportError(error,{context:"Equipe > alterar permissão da recepção"});
    } finally {
      if(button.isConnected)button.disabled=false;
    }
  });
}
