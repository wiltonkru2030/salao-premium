/** Cabeçalho, navegação lateral e controles de perfil do App Profissional. */
import {navigationIcon} from "../../src/components/navigation-icons.js";
import {renderPlatformMark} from "../../src/components/platform-mark.js";
import {renderPlatformThemeToggle} from "../../src/components/platform-appearance.js";
import {professionalGreeting} from "../utils/header-preferences.js";
import {escapeHtml} from "../utils/formatters.js";

/** Renderiza a navegação a partir das páginas autorizadas pelo controlador. */
export function renderProfessionalShell({state, content, pages}) {
  const name = String(state.professional?.name || state.profile?.full_name || "Profissional").trim()||"Profissional";
  const greeting = professionalGreeting(new Date(),state.organization?.timezone);
  const navigation = pages.filter(page=>page!=="Configurações").map(page=>{
    const active = state.page===page||(page==="Perfil"&&state.page==="Configurações");
    const icon = navigationIcon(page==="Comandas"?"Comanda":page);
    const bell = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>';
    const profileIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>';
    return '<button type="button" class="nav-item'+(active?' active':'')+'" data-page="'+escapeHtml(page)+'"'+
      (active?' aria-current="page"':'')+'>'+(page==="Notificações"?bell:(page==="Perfil"?profileIcon:(icon?'<img src="'+escapeHtml(icon)+'" alt="" width="18" height="18">':"")))+'<span>'+
      escapeHtml(page)+'</span>'+(page==="Notificações"?'<span class="tag" data-professional-unread-count aria-label="Não lidas"'+(state.notificationsUnread>0?"":" hidden")+'>'+(state.notificationsUnread>99?"99+":state.notificationsUnread)+'</span>':"")+'</button>';
  }).join("");
  return `<div class="app-shell">
    <aside class="professional-sidebar" id="professional-sidebar">
      <div class="professional-sidebar-brand"><div class="brand sp-professional-brand">${renderPlatformMark()}<span>SALÃO PREMIUM<small>APP PROFISSIONAL</small></span></div>
      <button type="button" class="icon-button professional-menu-close" data-action="close-professional-menu" aria-label="Fechar menu"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>
      <nav aria-label="Navegação do App Profissional">${navigation}</nav>
      <div class="professional-sidebar-account">
        ${state.branches?.length>1?'<button type="button" class="nav-item" data-action="choose-professional-branch"><span>Trocar unidade</span></button>':""}
        ${state.contextCount>1?'<button type="button" class="nav-item" data-action="choose-professional-context"><span>Trocar salão</span></button>':""}
        <button type="button" class="nav-item" data-action="logout"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 17l5-5-5-5m5 5H3m10-8h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/></svg><span>Sair da conta</span></button>
      </div>
    </aside>
    <button class="professional-menu-scrim" type="button" data-action="close-professional-menu" tabindex="-1" aria-label="Fechar menu"></button>
    <div class="professional-workspace">
      <header class="top">
        <button type="button" class="icon-button professional-menu-toggle" data-action="open-professional-menu" aria-label="Abrir menu" aria-controls="professional-sidebar" aria-expanded="false"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>
        <div class="professional-top-brand professional-header-identity">
          ${renderPlatformMark()}<div class="professional-header-copy"><span class="professional-header-brand">SALÃO PREMIUM</span><span class="professional-header-greeting" data-professional-greeting>${escapeHtml(greeting)}</span><strong class="professional-header-name">${escapeHtml(name)}</strong></div>
        </div>
        ${renderPlatformThemeToggle()}
      </header>
      <main class="content sp-page-flow">${state.branchId?'<p class="meta">Unidade operacional: '+escapeHtml(state.branches.find(row=>row.id===state.branchId)?.name||"Unidade")+'</p>':""}${state.notice?'<div class="notice" role="status">'+escapeHtml(state.notice)+'</div>':''}${content}</main>
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
