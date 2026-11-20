/** Apresentação das configurações administrativas e modais cadastrais. */
import {esc} from "../../utils.js";
import {renderAvailabilitySettings} from "../availability/availability-settings.view.js";
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

export const timezones = ["America/Campo_Grande", "America/Sao_Paulo", "America/Manaus", "America/Belem", "America/Fortaleza", "America/Noronha"];
const timezoneLabel = value => ({
  "America/Campo_Grande": "Mato Grosso do Sul",
  "America/Sao_Paulo": "Brasília / São Paulo",
  "America/Manaus": "Manaus",
  "America/Belem": "Belém",
  "America/Fortaleza": "Fortaleza",
  "America/Noronha": "Fernando de Noronha"
})[value] || value || "Não definido";


/** Renderiza organização, unidades, vitrine e expediente conforme permissões. */
export function renderSettingsView({organization,units,selectedBranch,canManage,publicProfile,branchPublicProfile,publicDirectoryReady,availability,availabilityError=false}){
    return `
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

      ${availabilityError
        ? '<section class="surface settings-panel" style="margin-top:18px"><h2>Expediente e disponibilidade</h2><p>Não foi possível consultar os horários desta unidade. Verifique as permissões ou tente novamente.</p></section>'
        : selectedBranch && !canManage
          ? '<section class="surface settings-panel" style="margin-top:18px"><h2>Expediente e disponibilidade</h2><p>A alteração de horários é restrita a proprietário e administrador.</p></section>'
          : renderAvailabilitySettings(availability, canManage)}

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

}
