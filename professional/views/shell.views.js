/** Cabeçalho, navegação lateral e controles de perfil do App Profissional. */
import {navigationIcon} from "../../src/components/navigation-icons.js";
import {renderPlatformMark} from "../../src/components/platform-mark.js";
import {escapeHtml} from "../utils/formatters.js";

/** Renderiza a navegação a partir das páginas autorizadas pelo controlador. */
export function renderProfessionalShell({state, content, pages}) {
  const greeting = (state.professional?.name || state.profile?.full_name || "Equipe").split(" ")[0];
  const navigation = pages.filter(page=>page!=="Configurações").map(page=>{
    const active = state.page===page;
    const icon = navigationIcon(page==="Comandas"?"Comanda":page);
    return '<button type="button" class="nav-item'+(active?' active':'')+'" data-page="'+escapeHtml(page)+'"'+
      (active?' aria-current="page"':'')+'><img src="'+escapeHtml(icon)+'" alt="" width="18" height="18"><span>'+
      escapeHtml(page)+'</span></button>';
  }).join("");
  return `<div class="app-shell">
    <aside class="professional-sidebar" id="professional-sidebar">
      <div class="professional-sidebar-brand"><div class="brand sp-professional-brand">${renderPlatformMark()}<span>SALÃO PREMIUM<small>APP PROFISSIONAL</small></span></div>
      <button type="button" class="icon-button professional-menu-close" data-action="close-professional-menu" aria-label="Fechar menu">×</button></div>
      <nav aria-label="Navegação do App Profissional">${navigation}</nav>
    </aside>
    <button class="professional-menu-scrim" type="button" data-action="close-professional-menu" tabindex="-1" aria-label="Fechar menu"></button>
    <div class="professional-workspace">
      <header class="top">
        <button type="button" class="icon-button professional-menu-toggle" data-action="open-professional-menu" aria-label="Abrir menu" aria-controls="professional-sidebar" aria-expanded="false">☰</button>
        <h1>Olá, ${escapeHtml(greeting)}</h1>
        <details class="professional-profile-menu"><summary class="secondary">Perfil</summary><div class="detail">
          <button type="button" class="secondary" data-page="Configurações">Configurações</button>
          <button type="button" class="secondary" data-action="logout">Sair</button>
        </div></details>
      </header>
      <main class="content">${state.notice?'<div class="notice">'+escapeHtml(state.notice)+'</div>':''}${content}</main>
    </div>
  </div>`;
}

/** Abre ou fecha o menu móvel e move o foco para o controle correspondente. */
export function setProfessionalMenuOpen(root, open) {
  const shell = root.querySelector(".app-shell");
  const toggle = shell?.querySelector(".professional-menu-toggle");
  if (!toggle) return;
  shell.classList.toggle("is-menu-open",open);
  toggle.setAttribute("aria-expanded",String(open));
  shell.querySelector(".professional-workspace").inert=open;
  (open?shell.querySelector(".professional-menu-close"):toggle).focus();
}
