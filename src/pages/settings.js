/**
 * Módulo: Configurações administrativas.
 * Responsabilidade: consultar e editar dados reais da organização e da unidade selecionada.
 * Segurança: gravações limitadas a owner/admin pela interface e, principalmente, pelas políticas RLS.
 * Escopo: dados cadastrais e expediente têm persistência; notificações, cobrança e outras preferências seguem pendentes.
 */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, toast } from "../utils.js";
import { reportError } from "../utils/errors.js";
import { renderAvailabilitySettings, bindAvailabilitySettings } from "../modules/availability/availability-settings.view.js";


/** Converte nome empresarial em sugestão de slug sem substituir o valor confirmado pelo administrador. */
function suggestPublicSlug(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

/**
 * Renderiza a configuração da vitrine pública; dados só ficam públicos após publicação explícita.
 * @param {object} options Perfil, filial selecionada, permissão e disponibilidade do schema.
 * @returns {string} Formulário administrativo ou explicação do estado de ativação.
 */
function renderPublicProfileSettings({organization, branch, profile, branchProfile, canManage, ready}) {
  if (!ready) {
    return '<div class="surface settings-panel public-profile-panel"><h2>Vitrine pública</h2><p>O módulo de publicação está aguardando a migration revisável do diretório público. Nenhum dado será exposto enquanto ela não for aplicada.</p></div>';
  }
  if (!branch) {
    return '<div class="surface settings-panel public-profile-panel"><h2>Vitrine pública</h2><p>Cadastre uma unidade antes de publicar o salão.</p></div>';
  }
  if (!canManage) {
    return '<div class="surface settings-panel public-profile-panel"><h2>Vitrine pública</h2><p>Somente proprietário ou administrador pode configurar a publicação.</p></div>';
  }
  const displayName = profile?.display_name || organization.name || "";
  const slug = profile?.slug || suggestPublicSlug(displayName);
  return '<section class="surface settings-panel public-profile-panel">' +
    '<div class="section-heading"><div><h2>Vitrine pública</h2><p>Publique o salão e a unidade para aparecerem na busca da Área da Cliente.</p></div></div>' +
    '<form id="public-profile-form" data-branch-id="' + esc(branch.id) + '">' +
      '<div class="sp-modal-body">' +
        '<label>Endereço público (slug)<input name="slug" required maxlength="80" pattern="[a-z0-9]+(-[a-z0-9]+)*" value="' + esc(slug) + '" placeholder="meu-salao"></label>' +
        '<label>Nome exibido<input name="display_name" required maxlength="120" value="' + esc(displayName) + '"></label>' +
        '<label class="sp-span">Descrição pública<textarea name="description" maxlength="1000" rows="3">' + esc(profile?.description || "") + '</textarea></label>' +
        '<label>Logo (URL HTTPS)<input name="logo_url" type="url" value="' + esc(profile?.logo_url || "") + '" placeholder="https://..."></label>' +
        '<label>Capa (URL HTTPS)<input name="cover_image_url" type="url" value="' + esc(profile?.cover_image_url || "") + '" placeholder="https://..."></label>' +
        '<label>Telefone público<input name="public_phone" data-mask="phone" type="tel" value="' + esc(profile?.public_phone || organization.phone || "") + '"></label>' +
        '<label>Site (URL HTTPS)<input name="website_url" type="url" value="' + esc(profile?.website_url || "") + '" placeholder="https://..."></label>' +
        '<label>Instagram (URL HTTPS)<input name="instagram_url" type="url" value="' + esc(profile?.instagram_url || "") + '" placeholder="https://instagram.com/..."></label>' +
        '<label class="public-check"><input type="checkbox" name="is_published" ' + (profile?.is_published ? "checked" : "") + '> Publicar o perfil do salão</label>' +
        '<h3 class="sp-span">Dados públicos da unidade: ' + esc(branch.name) + '</h3>' +
        '<label>Endereço que será exibido<input name="public_address" maxlength="180" value="' + esc(branchProfile?.public_address || "") + '" placeholder="Rua, número e complemento"></label>' +
        '<label>Bairro<input name="neighborhood" maxlength="100" value="' + esc(branchProfile?.neighborhood || "") + '"></label>' +
        '<label>Cidade<input name="city" required maxlength="100" value="' + esc(branchProfile?.city || "") + '"></label>' +
        '<label>UF<input name="state" required maxlength="2" pattern="[A-Za-z]{2}" value="' + esc(branchProfile?.state || "") + '" placeholder="MS"></label>' +
        '<label>CEP<input name="postal_code" data-mask="cep" inputmode="numeric" maxlength="9" value="' + esc(branchProfile?.postal_code || "") + '"></label>' +
        '<label>Telefone da unidade<input name="branch_public_phone" data-mask="phone" type="tel" value="' + esc(branchProfile?.public_phone || branch.phone || "") + '"></label>' +
        '<label>Latitude (opcional)<input name="latitude" type="number" min="-90" max="90" step="any" value="' + esc(branchProfile?.latitude ?? "") + '"></label>' +
        '<label>Longitude (opcional)<input name="longitude" type="number" min="-180" max="180" step="any" value="' + esc(branchProfile?.longitude ?? "") + '"></label>' +
        '<label class="public-check"><input type="checkbox" name="branch_is_published" ' + (branchProfile?.is_published ? "checked" : "") + '> Publicar esta unidade na busca</label>' +
      '</div>' +
      '<p class="demo-note">Ao publicar, nome, descrição, logo, telefone, endereço e localização informados serão visíveis às clientes. Nunca informe CPF, CNPJ, e-mail privado ou dados de clientes aqui.</p>' +
      '<footer class="sp-modal-foot"><button class="btn primary" type="submit">Salvar vitrine pública</button></footer>' +
    '</form></section>';
}

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
    let publicProfile = null;
    let branchPublicProfile = null;
    let publicDirectoryReady = true;
    // O perfil profissional não possui SELECT nas tabelas administrativas da vitrine pública.
    if (canManage) {
      try {
        const [profileResult, branchProfileResult] = await Promise.all([
          supabase.from("salon_public_profiles").select("*").eq("org_id", orgId).maybeSingle(),
          selectedBranch
            ? supabase.from("branch_public_profiles").select("*").eq("org_id", orgId).eq("branch_id", selectedBranch.id).maybeSingle()
            : Promise.resolve({data:null,error:null})
        ]);
        if (profileResult.error) throw profileResult.error;
        if (branchProfileResult.error) throw branchProfileResult.error;
        publicProfile = profileResult.data;
        branchPublicProfile = branchProfileResult.data;
      } catch (error) {
        if (["PGRST205", "42P01"].includes(error?.code)) publicDirectoryReady = false;
        else throw error;
      }
    }
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

      ${renderPublicProfileSettings({organization,branch:selectedBranch,profile:publicProfile,branchProfile:branchPublicProfile,canManage,ready:publicDirectoryReady})}

      ${renderAvailabilitySettings(availability, canManage)}

      <section class="surface settings-panel" style="margin-top:18px">
        <div class="section-heading"><div><h2>Preferências do sistema</h2><p>Recursos que ainda não possuem persistência validada no banco.</p></div></div>
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
        if (!form.matches("#public-profile-form")) return;
        event.preventDefault();
        if (!canManageSettings()) return toast("Somente proprietário ou administrador pode publicar o salão.");
        const values = new FormData(form);
        const slug = String(values.get("slug") || "").trim().toLowerCase();
        const displayName = String(values.get("display_name") || "").trim();
        const city = String(values.get("city") || "").trim();
        const stateCode = String(values.get("state") || "").trim().toUpperCase();
        const latitudeText = String(values.get("latitude") || "").trim();
        const longitudeText = String(values.get("longitude") || "").trim();
        const latitude = latitudeText ? Number(latitudeText) : null;
        const longitude = longitudeText ? Number(longitudeText) : null;
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return toast("O endereço público deve usar letras minúsculas, números e hífens.");
        if (displayName.length < 2) return toast("Informe o nome público do salão.");
        if (city.length < 2 || !/^[A-Z]{2}$/.test(stateCode)) return toast("Informe cidade e UF válidas.");
        if ((latitude === null) !== (longitude === null) ||
            (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
             !Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
          return toast("Informe latitude e longitude válidas juntas, ou deixe ambas vazias.");
        }
        for (const field of ["logo_url","cover_image_url","website_url","instagram_url"]) {
          const value = String(values.get(field) || "").trim();
          if (value && !value.startsWith("https://")) return toast("Todos os links públicos devem começar com https://.");
        }
        const submit = form.querySelector('[type="submit"]');
        submit.disabled = true;
        try {
          const { data, error } = await supabase.rpc("save_public_salon_profile", {
            p_org_id: orgId,
            p_branch_id: form.dataset.branchId,
            p_slug: slug,
            p_display_name: displayName,
            p_description: String(values.get("description") || "").trim() || null,
            p_logo_url: String(values.get("logo_url") || "").trim() || null,
            p_cover_image_url: String(values.get("cover_image_url") || "").trim() || null,
            p_public_phone: String(values.get("public_phone") || "").trim() || null,
            p_website_url: String(values.get("website_url") || "").trim() || null,
            p_instagram_url: String(values.get("instagram_url") || "").trim() || null,
            p_is_published: values.get("is_published") === "on",
            p_public_address: String(values.get("public_address") || "").trim() || null,
            p_neighborhood: String(values.get("neighborhood") || "").trim() || null,
            p_city: city,
            p_state: stateCode,
            p_postal_code: String(values.get("postal_code") || "").trim() || null,
            p_latitude: latitude,
            p_longitude: longitude,
            p_branch_public_phone: String(values.get("branch_public_phone") || "").trim() || null,
            p_branch_is_published: values.get("branch_is_published") === "on"
          });
          if (error) throw error;
          if (data !== true) throw new Error("A vitrine não foi salva. Confira as permissões e tente novamente.");
          toast("Vitrine pública atualizada.");
          await loadSettingsPage();
        } catch (error) {
          reportError(error, { context: "Configurações > salvar vitrine pública" });
        } finally {
          if (submit.isConnected) submit.disabled = false;
        }
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
