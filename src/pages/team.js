/** Módulo Equipe e permissões. Responsabilidade: administrar membros, acessos ao App Profissional e atribuições por unidade. */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, toast } from "../utils.js";
import { reportError } from "../utils/errors.js";

const roleLabel = role => ({
  owner: "Proprietário",
  admin: "Administrador",
  manager: "Gerente",
  receptionist: "Recepção",
  professional: "Profissional",
  finance: "Financeiro",
  viewer: "Consulta"
})[role] || role;

const canManageTeam = () => ["owner", "admin"].includes(state.membership?.role);
let teamLoadSequence = 0;

function branchOptions(branches) {
  const main = branches.find(branch => branch.is_main);
  return [
    { id: "__main__", branchId: null, name: (main?.name || "Matriz") + " · Matriz" },
    ...branches
      .filter(branch => !branch.is_main)
      .map(branch => ({ id: branch.id, branchId: branch.id, name: branch.name }))
  ];
}

function renderMemberCard(member, profile, assignments, units) {
  const isGlobal = ["owner", "admin"].includes(member.role);
  const isReception = member.role === "receptionist";
  const appEnabled = member.professional_app_enabled === true;
  const fullCalendar = member.professional_app_scope === "calendar_all";
  const assignedIds = new Set(assignments.map(item => item.branch_id === null ? "__main__" : item.branch_id));

  const branchControls = isGlobal
    ? '<div class="team-global-access"><span class="status success">Acesso global</span><small>Proprietários e administradores acessam todas as unidades automaticamente.</small></div>'
    : '<fieldset class="team-branch-fieldset"><legend>Unidades permitidas</legend><div class="team-branch-options">' +
      units.map(unit => {
        const checked = assignedIds.has(unit.id) ? "checked" : "";
        return '<label class="team-branch-option"><input type="checkbox" data-branch-assignment value="' +
          esc(unit.id) + '" ' + checked + '><span>' + esc(unit.name) + '</span></label>';
      }).join("") +
      '</div><small class="team-assignment-current">' +
      (assignedIds.size
        ? "Unidades atualmente liberadas: " + esc(units.filter(unit => assignedIds.has(unit.id)).map(unit => unit.name).join(", "))
        : "Nenhuma unidade liberada") +
      '</small></fieldset>';

  const professionalAccess = isReception
    ? '<div class="team-professional-access"><div><b>App Profissional</b><small>' +
      (appEnabled && fullCalendar ? "Agenda completa liberada" : "Sem acesso à agenda completa") +
      '</small></div><button class="btn ' + (appEnabled && fullCalendar ? "secondary" : "primary") +
      '" data-reception-access="' + esc(member.user_id) + '" data-enabled="' +
      (appEnabled && fullCalendar ? "true" : "false") + '">' +
      (appEnabled && fullCalendar ? "Revogar acesso" : "Liberar agenda completa") +
      '</button></div>'
    : member.role === "professional"
      ? '<p class="demo-note">O acesso do profissional é controlado pelo cadastro e vínculo profissional.</p>'
      : "";

  return '<article class="team-member-card" data-member-card="' + esc(member.id) +
    '" data-target-user="' + esc(member.user_id) + '">' +
    '<div class="team-member-heading"><div><b>' + esc(profile.full_name || "Usuário sem nome") +
    '</b><small>' + esc(roleLabel(member.role)) + ' · ' + esc(member.status) +
    '</small><small>' + esc(profile.phone || "Conta vinculada") + '</small></div></div>' +
    branchControls +
    (!isGlobal ? '<div class="team-member-actions"><span class="team-selection-hint">Nenhuma unidade selecionada bloqueia o acesso operacional.</span>' +
      '<button class="btn primary" data-save-branch-access>Salvar unidades</button></div>' : "") +
    professionalAccess +
    '</article>';
}

export function teamPage() {
  const description = "Gerencie os usuários, as permissões e as unidades que cada pessoa pode acessar.";
  if (!canManageTeam()) {
    return head("Equipe e permissões", description) +
      '<div class="empty-state"><b>Acesso restrito.</b><small>Somente proprietários e administradores podem gerenciar a equipe e as permissões por unidade.</small></div>';
  }
  return head("Equipe e permissões", description) +
    '<div id="team-manager"><div class="empty-state">Carregando equipe…</div></div>';
}

export async function loadTeamPage() {
  const host = document.querySelector("#team-manager");
  if (!host || !state.organization?.id || !canManageTeam()) return;

  const orgId = state.organization.id;
  const requestId = ++teamLoadSequence;

  try {
    const { data: members, error: membersError } = await supabase
      .from("org_memberships")
      .select("id,user_id,role,status,professional_app_enabled,professional_app_scope,created_at")
      .eq("org_id", orgId)
      .order("created_at");

    if (membersError) throw membersError;
    if (requestId !== teamLoadSequence || !host.isConnected || state.organization?.id !== orgId) return;

    const ids = [...new Set((members || []).map(member => member.user_id))];
    const [profileResult, branchResult, accessResult] = await Promise.all([
      ids.length
        ? supabase.from("profiles").select("id,full_name,phone").in("id", ids)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("branches").select("id,name,is_main,active")
        .eq("org_id", orgId).eq("active", true)
        .order("is_main", { ascending: false }).order("name"),
      ids.length
        ? supabase.from("org_membership_branch_access")
          .select("membership_id,branch_id").eq("org_id", orgId)
        : Promise.resolve({ data: [], error: null })
    ]);

    if (profileResult.error) throw profileResult.error;
    if (branchResult.error) throw branchResult.error;
    if (accessResult.error) throw accessResult.error;
    if (requestId !== teamLoadSequence || !host.isConnected || state.organization?.id !== orgId) return;

    const profileMap = new Map((profileResult.data || []).map(profile => [profile.id, profile]));
    const assignmentMap = new Map();
    for (const item of accessResult.data || []) {
      const list = assignmentMap.get(item.membership_id) || [];
      list.push(item);
      assignmentMap.set(item.membership_id, list);
    }

    const units = branchOptions(branchResult.data || []);
    host.innerHTML =
      '<div class="list-toolbar"><span class="result-count">' + (members?.length || 0) +
      ' usuário(s) vinculados</span></div>' +
      '<div class="team-member-list">' +
      (members || []).map(member => renderMemberCard(
        member,
        profileMap.get(member.user_id) || {},
        assignmentMap.get(member.id) || [],
        units
      )).join("") +
      (members?.length ? "" : '<div class="empty-state">Nenhum usuário vinculado ao salão.</div>') +
      '</div>' +
      '<p class="demo-note">Atribuições por unidade são validadas no banco. O isolamento só estará ativo após as migrations de segurança serem aplicadas e homologadas.</p>';

    if (host.dataset.bound === "true") return;
    host.dataset.bound = "true";

    host.addEventListener("click", async event => {
      const saveButton = event.target.closest("[data-save-branch-access]");
      if (saveButton) {
        const card = saveButton.closest("[data-member-card]");
        if (!card) return;

        const selected = [...card.querySelectorAll("[data-branch-assignment]:checked")]
          .map(input => input.value === "__main__" ? null : input.value);

        saveButton.disabled = true;
        saveButton.textContent = "Salvando…";
        try {
          const { error } = await supabase.rpc("set_org_membership_branch_access", {
            p_org_id: orgId,
            p_target_user_id: card.dataset.targetUser,
            p_branch_ids: selected
          });
          if (error) throw error;
          toast(selected.length
            ? "Unidades autorizadas atualizadas."
            : "Acesso operacional removido deste usuário.");
          await loadTeamPage();
        } catch (error) {
          reportError(error, { context: "Equipe > salvar unidades do membro" });
          saveButton.disabled = false;
          saveButton.textContent = "Salvar unidades";
        }
        return;
      }

      const appButton = event.target.closest("[data-reception-access]");
      if (!appButton) return;
      const currentlyEnabled = appButton.dataset.enabled === "true";
      appButton.disabled = true;
      appButton.textContent = "Atualizando…";
      try {
        const { data, error } = await supabase.rpc("set_professional_app_access", {
          p_target_user_id: appButton.dataset.receptionAccess,
          p_enabled: !currentlyEnabled,
          p_scope: "calendar_all"
        });
        if (error) throw error;
        toast(data?.enabled
          ? "Agenda completa liberada para a recepção."
          : "Acesso ao App Profissional revogado.");
        await loadTeamPage();
      } catch (error) {
        reportError(error, { context: "Equipe > alterar permissão da recepção" });
        appButton.disabled = false;
        appButton.textContent = currentlyEnabled ? "Revogar acesso" : "Liberar agenda completa";
      }
    });
  } catch (error) {
    if (requestId !== teamLoadSequence || !host.isConnected) return;
    reportError(error, { context: "Equipe > carregar usuários e unidades" });
    host.innerHTML = '<div class="empty-state"><b>Não foi possível carregar a equipe.</b>' +
      '<small>Confira se as migrations de permissões por filial foram aplicadas e tente novamente.</small></div>';
  }
}
