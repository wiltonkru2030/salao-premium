/**
 * Módulo: Unidades e filiais.
 * Responsabilidade: consultar, cadastrar e ativar/inativar filiais da organização autenticada.
 * Segurança: as consultas e mutações também dependem das políticas RLS de public.branches.
 * Limite: endereço detalhado e exclusão definitiva não são alterados por esta tela.
 */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, toast, btn } from "../utils.js";
import { reportError } from "../utils/errors.js";

let modalListenerInstalled = false;

/** Somente proprietário e administrador podem cadastrar ou alterar unidades. */
const canManageBranches = () => ["owner", "admin"].includes(state.membership?.role);

/** Renderiza a página e mantém os dados carregados pelo Supabase fora do HTML inicial. */
export function branchesPage() {
  return head("Unidades", "Gerencie as filiais vinculadas à organização.", canManageBranches()
    ? btn("＋ Nova unidade", "open-branch-modal", "primary")
    : "") + '<div id="branches-manager"><div class="empty-state">Carregando unidades…</div></div>';
}

/** Consulta as unidades do tenant ativo, sem permitir acesso cruzado entre organizações. */
export async function loadBranchesPage() {
  const host = document.querySelector("#branches-manager");
  if (!host || !state.organization?.id) return;

  try {
    const { data, error } = await supabase.from("branches")
      .select("id,name,phone,email,document,is_main,active,created_at")
      .eq("org_id", state.organization.id)
      .order("is_main", { ascending: false })
      .order("name", { ascending: true })
      .limit(200);
    if (error) throw error;

    const branches = data || [];
    const canManage = canManageBranches();
    host.innerHTML = `
      <dialog class="sp-modal" id="branch-create-modal" aria-labelledby="branch-modal-title">
        <div class="sp-modal-shell">
          <header class="sp-modal-head">
            <div><h2 id="branch-modal-title">Nova unidade</h2><p>Cadastre uma filial vinculada a esta organização.</p></div>
            <button class="sp-modal-close" type="button" data-close-branch-modal aria-label="Fechar">×</button>
          </header>
          <form id="branch-create-form">
            <div class="sp-modal-body">
              <label class="sp-span">Nome da unidade<input name="name" required maxlength="120" placeholder="Ex.: Unidade Centro"></label>
              <label>Telefone<input name="phone" type="tel" data-mask="phone" maxlength="20" placeholder="(00) 00000-0000"></label>
              <label>E-mail<input name="email" type="email" maxlength="160" placeholder="unidade@seudominio.com"></label>
              <label class="sp-span">Documento (opcional)<input name="document" maxlength="30" placeholder="CPF ou CNPJ"></label>
            </div>
            <footer class="sp-modal-foot">
              <button class="btn secondary" type="button" data-close-branch-modal>Cancelar</button>
              <button class="btn primary" type="submit">Cadastrar unidade</button>
            </footer>
          </form>
        </div>
      </dialog>
      <div class="list-toolbar"><span class="result-count">${branches.length} unidade(s)</span></div>
      <div class="record-list">${branches.map(item => `
        <article class="record-card">
          <span class="record-main">
            <b>${esc(item.name)} ${item.is_main ? '<small>· Matriz</small>' : ''}</b>
            <small>${esc(item.phone || "Telefone não informado")}</small>
            <small>${esc(item.email || item.document || "")}</small>
          </span>
          <span class="record-trailing">
            <small>${item.active ? "Ativa" : "Inativa"}</small>
            ${canManage ? '<button class="btn secondary" type="button" data-toggle-branch="' + esc(item.id) + '" data-active="' + String(item.active) + '">' + (item.active ? "Inativar" : "Reativar") + '</button>' : ''}
          </span>
        </article>`).join("") || '<div class="empty-state">Nenhuma unidade cadastrada.</div>'}</div>
      <p class="demo-note">As alterações respeitam as permissões da organização. A matriz não é excluída nem modificada por esta tela.</p>`;

    if (host.dataset.bound !== "true") {
      host.dataset.bound = "true";

      // O botão de abertura fica no cabeçalho, fora do elemento que contém o modal.
      if (!modalListenerInstalled) {
        modalListenerInstalled = true;
        document.addEventListener("click", event => {
          const dialog = document.querySelector("#branch-create-modal");
          if (!dialog) return;
          if (event.target.closest('[data-action="open-branch-modal"]') && canManageBranches()) {
            if (!dialog.open) dialog.showModal();
          } else if (event.target.closest("[data-close-branch-modal]") || event.target === dialog) {
            if (dialog.open) dialog.close();
          }
        });
      }

      host.addEventListener("submit", async event => {
        if (!event.target.matches("#branch-create-form")) return;
        event.preventDefault();
        if (!canManageBranches()) {
          toast("Seu perfil não pode cadastrar unidades.");
          return;
        }
        const form = event.target;
        const values = new FormData(form);
        const name = String(values.get("name") || "").trim();
        const email = String(values.get("email") || "").trim();
        if (!name) {
          toast("Informe o nome da unidade.");
          return;
        }
        if (email && !form.elements.email.validity.valid) {
          toast("Informe um e-mail válido.");
          return;
        }

        const submit = form.querySelector('[type="submit"]');
        submit.disabled = true;
        try {
          const { error: insertError } = await supabase.from("branches").insert({
            org_id: state.organization.id,
            name,
            phone: String(values.get("phone") || "").trim() || null,
            email: email || null,
            document: String(values.get("document") || "").trim() || null,
            address: {},
            is_main: false,
            active: true
          });
          if (insertError) throw insertError;
          host.querySelector("#branch-create-modal")?.close();
          toast("Unidade cadastrada.");
          await loadBranchesPage();
        } catch (error) {
          reportError(error, { context: "Unidades > cadastrar filial" });
        } finally {
          if (submit.isConnected) submit.disabled = false;
        }
      });

      host.addEventListener("click", async event => {
        const button = event.target.closest("[data-toggle-branch]");
        if (!button) return;
        if (!canManageBranches()) {
          toast("Seu perfil não pode alterar unidades.");
          return;
        }
        const branchId = button.dataset.toggleBranch;
        const nextActive = button.dataset.active !== "true";
        button.disabled = true;
        try {
          const { error: updateError } = await supabase.from("branches")
            .update({ active: nextActive, updated_at: new Date().toISOString() })
            .eq("id", branchId)
            .eq("org_id", state.organization.id);
          if (updateError) throw updateError;
          toast(nextActive ? "Unidade reativada." : "Unidade inativada.");
          await loadBranchesPage();
        } catch (error) {
          reportError(error, { context: "Unidades > alterar situação da filial" });
          button.disabled = false;
        }
      });
    }
  } catch (error) {
    reportError(error, { context: "Unidades > carregar filiais" });
    host.innerHTML = '<div class="empty-state"><b>Não foi possível carregar as unidades.</b><small>Verifique sua conexão e suas permissões. Tente novamente.</small></div>';
  }
}
