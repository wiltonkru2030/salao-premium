/**
 * Módulo: Configurações administrativas.
 * Responsabilidade: consultar e editar dados reais da organização e da unidade selecionada.
 * Segurança: gravações limitadas a owner/admin pela interface e, principalmente, pelas políticas RLS.
 * Escopo: preferências de agenda, notificações, plano e segurança ainda não possuem configuração persistente validada.
 */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, toast } from "../utils.js";
import { reportError } from "../utils/errors.js";
import { renderAvailabilitySettings, bindAvailabilitySettings } from "../modules/availability/availability-settings.view.js";

const canManageSettings = () => ["owner", "admin"].includes(state.membership?.role);
const timezones = ["America/Campo_Grande", "America/Sao_Paulo", "America/Manaus", "America/Belem", "America/Fortaleza", "America/Noronha"];
const timezoneLabel = value => ({
  "America/Campo_Grande": "Mato Grosso do Sul",
  "America/Sao_Paulo": "Brasília / São Paulo",
  "America/Manaus": "Manaus",
  "America/Belem": "Belém",
  "America/Fortaleza": "Fortaleza",
  "America/Noronha": "Fernando de Noronha"
})[value] || value || "Não definido";

/** Renderiza a estrutura inicial; os dados reais são carregados sem recarregar a página. */
export function settings() {
  return head("Configurações", "Dados da organização e das unidades, com alterações protegidas por perfil.") +
    '<div id="settings-manager"><div class="empty-state">Carregando configurações…</div></div>';
}

/** Consulta organização e unidades sempre limitadas ao tenant autenticado. */
export async function loadSettingsPage() {
  const host = document.querySelector("#settings-manager");
  const orgId = state.organization?.id;
  if (!host || !orgId) return;

  try {
    const [{ data: organization, error: orgError }, { data: branches, error: branchError }] = await Promise.all([
      supabase.from("organizations")
        .select("id,name,document,phone,email,timezone,currency")
        .eq("id", orgId).maybeSingle(),
      supabase.from("branches")
        .select("id,name,phone,email,document,is_main,active")
        .eq("org_id", orgId)
        .order("is_main", { ascending: false })
        .order("name", { ascending: true })
        .limit(200)
    ]);
    if (orgError) throw orgError;
    if (branchError) throw branchError;
    if (!organization) throw new Error("Organização não encontrada.");

    const units = branches || [];
    const selectedBranch = units.find(item => item.id === state.branch?.id) ||
      units.find(item => item.is_main) || units[0] || null;
    state.branch = selectedBranch;
    const canManage = canManageSettings();
    const availability = selectedBranch ? await listAvailabilitySettings(orgId, selectedBranch.id) : null;

    host.innerHTML = `
      <section class="surface settings-panel">
        <div class="section-heading">
          <div><h2>Organização</h2><p>Informações cadastrais compartilhadas pelas unidades.</p></div>
          ${canManage ? '<button class="btn secondary" type="button" data-open-settings="organization">Editar dados</button>' : ''}
        </div>
        <div class="record-list">
          <article class="record-card"><span class="record-main"><b>${esc(organization.name)}</b><small>Nome empresarial exibido no painel</small></span><span class="record-trailing"><small>${esc(organization.currency || "BRL")}</small></span></article>
          <article class="record-card"><span class="record-main"><b>Contato</b><small>${esc(organization.phone || "Telefone não informado")} · ${esc(organization.email || "E-mail não informado")}</small></span></article>
          <article class="record-card"><span class="record-main"><b>Documento</b><small>${esc(organization.document || "Não informado")}</small></span></article>
          <article class="record-card"><span class="record-main"><b>Fuso horário</b><small>${esc(timezoneLabel(organization.timezone))} · ${esc(organization.timezone)}</small></span></article>
        </div>
      </section>

      <section class="surface settings-panel" style="margin-top:18px">
        <div class="section-heading">
          <div><h2>Unidades e filiais</h2><p>Dados de contato e identificação da unidade selecionada.</p></div>
          ${canManage && selectedBranch ? '<button class="btn secondary" type="button" data-open-settings="branch">Editar unidade</button>' : ''}
        </div>
        ${units.length ? `
          <label class="settings-branch-select">Unidade selecionada
            <select id="settings-branch-select">
              ${units.map(unit => '<option value="' + esc(unit.id) + '" ' + (unit.id === selectedBranch?.id ? "selected" : "") + '>' + esc(unit.name) + (unit.is_main ? " · Matriz" : "") + (unit.active ? "" : " · Inativa") + '</option>').join("")}
            </select>
          </label>
          ${selectedBranch ? `
            <div class="record-list">
              <article class="record-card"><span class="record-main"><b>${esc(selectedBranch.name)}</b><small>${selectedBranch.is_main ? "Unidade matriz" : "Filial"} · ${selectedBranch.active ? "Ativa" : "Inativa"}</small></span></article>
              <article class="record-card"><span class="record-main"><b>Contato</b><small>${esc(selectedBranch.phone || "Telefone não informado")} · ${esc(selectedBranch.email || "E-mail não informado")}</small></span></article>
              <article class="record-card"><span class="record-main"><b>Documento</b><small>${esc(selectedBranch.document || "Não informado")}</small></span></article>
            </div>` : ''}
        ` : '<div class="empty-state">Nenhuma unidade cadastrada. Cadastre uma unidade antes de editar seus dados.</div>'}
      </section>

      <section class="surface settings-panel" style="margin-top:18px">
        <div class="section-heading"><div>${renderAvailabilitySettings(availability, canManage)}<h2>Preferências do sistema</h2><p>Recursos que ainda não possuem persistência validada no banco.</p></div></div>
        <div class="record-list">
          <article class="record-card"><span class="record-main"><b>Disponibilidade online</b><small>Expediente e exceções são configurados na seção acima. Regras de antecedência e políticas de cancelamento ainda estão pendentes.</small></span><span class="record-trailing"><small>Em implementação</small></span></article>
          <article class="record-card"><span class="record-main"><b>Notificações</b><small>Envio de lembretes e integrações de WhatsApp/e-mail não estão ativados por esta tela.</small></span><span class="record-trailing"><small>Em implementação</small></span></article>
          <article class="record-card"><span class="record-main"><b>Plano e assinatura</b><small>Não há cobrança ou assinatura conectada.</small></span><span class="record-trailing"><small>Não conectado</small></span></article>
        </div>
      </section>

      <dialog class="sp-modal" id="settings-organization-modal" aria-labelledby="settings-organization-title">
        <div class="sp-modal-shell">
          <header class="sp-modal-head"><div><h2 id="settings-organization-title">Editar organização</h2><p>Os dados são compartilhados entre as unidades.</p></div><button class="sp-modal-close" type="button" data-close-settings aria-label="Fechar">×</button></header>
          <form id="settings-organization-form">
            <div class="sp-modal-body">
              <label class="sp-span">Nome da organização<input name="name" required maxlength="160" value="${esc(organization.name)}"></label>
              <label>Telefone<input name="phone" type="tel" data-mask="phone" maxlength="20" value="${esc(organization.phone || "")}" placeholder="(00) 00000-0000"></label>
              <label>E-mail<input name="email" type="email" maxlength="160" value="${esc(organization.email || "")}" placeholder="contato@empresa.com.br"></label>
              <label class="sp-span">CPF ou CNPJ<input name="document" maxlength="30" value="${esc(organization.document || "")}" placeholder="Documento da organização"></label>
              <label class="sp-span">Fuso horário
                <select name="timezone">${timezones.map(zone => '<option value="' + zone + '" ' + (zone === organization.timezone ? "selected" : "") + '>' + esc(timezoneLabel(zone)) + '</option>').join("")}</select>
              </label>
              <label>Moeda<input value="${esc(organization.currency || "BRL")} · Real (R$)" disabled></label>
            </div>
            <footer class="sp-modal-foot"><button class="btn secondary" type="button" data-close-settings>Cancelar</button><button class="btn primary" type="submit">Salvar organização</button></footer>
          </form>
        </div>
      </dialog>

      <dialog class="sp-modal" id="settings-branch-modal" aria-labelledby="settings-branch-title">
        <div class="sp-modal-shell">
          <header class="sp-modal-head"><div><h2 id="settings-branch-title">Editar unidade</h2><p>Atualize os dados cadastrais desta filial.</p></div><button class="sp-modal-close" type="button" data-close-settings aria-label="Fechar">×</button></header>
          <form id="settings-branch-form" data-branch-id="${esc(selectedBranch?.id || "")}">
            <div class="sp-modal-body">
              <label class="sp-span">Nome da unidade<input name="name" required maxlength="120" value="${esc(selectedBranch?.name || "")}"></label>
              <label>Telefone<input name="phone" type="tel" data-mask="phone" maxlength="20" value="${esc(selectedBranch?.phone || "")}" placeholder="(00) 00000-0000"></label>
              <label>E-mail<input name="email" type="email" maxlength="160" value="${esc(selectedBranch?.email || "")}" placeholder="unidade@empresa.com.br"></label>
              <label class="sp-span">CPF ou CNPJ<input name="document" maxlength="30" value="${esc(selectedBranch?.document || "")}" placeholder="Documento da unidade"></label>
            </div>
            <footer class="sp-modal-foot"><button class="btn secondary" type="button" data-close-settings>Cancelar</button><button class="btn primary" type="submit">Salvar unidade</button></footer>
          </form>
        </div>
      </dialog>
      <p class="demo-note">Apenas proprietário e administrador podem editar. O banco aplica a mesma restrição por RLS; cada alteração cadastral da organização também é registrada pela auditoria do banco.</p>`;

    bindAvailabilitySettings(host,{orgId,branchId:selectedBranch?.id,canManage,reload:loadSettingsPage});

    if (host.dataset.bound !== "true") {
      host.dataset.bound = "true";

      host.addEventListener("click", event => {
        const opener = event.target.closest("[data-open-settings]");
        if (opener) {
          if (!canManageSettings()) return toast("Seu perfil tem acesso somente para consulta.");
          const dialog = document.querySelector(opener.dataset.openSettings === "organization"
            ? "#settings-organization-modal" : "#settings-branch-modal");
          if (dialog && !dialog.open) dialog.showModal();
          return;
        }
        if (event.target.closest("[data-close-settings]")) {
          host.querySelectorAll("dialog[open]").forEach(dialog => dialog.close());
        }
      });

      host.addEventListener("change", event => {
        if (event.target.id !== "settings-branch-select") return;
        state.branch = units.find(unit => unit.id === event.target.value) || null;
        loadSettingsPage();
      });

      host.addEventListener("submit", async event => {
        const form = event.target;
        if (!form.matches("#settings-organization-form, #settings-branch-form")) return;
        event.preventDefault();
        if (!canManageSettings()) return toast("Seu perfil não pode alterar configurações.");
        const values = new FormData(form);
        const name = String(values.get("name") || "").trim();
        const email = String(values.get("email") || "").trim();
        if (!name) return toast("Informe o nome.");
        if (email && !form.elements.email.validity.valid) return toast("Informe um e-mail válido.");

        const submit = form.querySelector('[type="submit"]');
        submit.disabled = true;
        const payload = {
          name,
          phone: String(values.get("phone") || "").trim() || null,
          email: email || null,
          document: String(values.get("document") || "").trim() || null
        };
        try {
          if (form.id === "settings-organization-form") {
            const timezone = String(values.get("timezone") || "");
            if (!timezones.includes(timezone)) throw new Error("Selecione um fuso horário válido.");
            const { data, error } = await supabase.from("organizations")
              .update({ ...payload, timezone, updated_at: new Date().toISOString() })
              .eq("id", orgId).select("id").maybeSingle();
            if (error) throw error;
            if (!data) throw new Error("A organização não foi atualizada. Verifique sua permissão.");
            state.organization = { ...state.organization, ...payload, timezone };
            toast("Dados da organização atualizados.");
          } else {
            const branchId = form.dataset.branchId;
            if (!branchId || !units.some(unit => unit.id === branchId)) throw new Error("Unidade inválida. Atualize a tela e tente novamente.");
            const { data, error } = await supabase.from("branches")
              .update({ ...payload, updated_at: new Date().toISOString() })
              .eq("id", branchId).eq("org_id", orgId).select("id").maybeSingle();
            if (error) throw error;
            if (!data) throw new Error("A unidade não foi atualizada. Verifique sua permissão.");
            toast("Dados da unidade atualizados.");
          }
          host.querySelectorAll("dialog[open]").forEach(dialog => dialog.close());
          await loadSettingsPage();
        } catch (error) {
          reportError(error, { context: "Configurações > salvar dados cadastrais" });
        } finally {
          if (submit.isConnected) submit.disabled = false;
        }
      });
    }
  } catch (error) {
    reportError(error, { context: "Configurações > carregar dados" });
    host.innerHTML = '<div class="empty-state"><b>Não foi possível carregar as configurações.</b><small>Verifique sua conexão e suas permissões. Tente novamente.</small></div>';
  }
}
