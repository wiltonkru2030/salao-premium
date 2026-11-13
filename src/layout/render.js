/** Compositor do painel. Responsabilidade: montar menu, cabeçalho, conteúdo da rota e disparar carregadores de cada módulo. */
import { groups, glyph } from '../data/index.js';

import { state } from '../state.js';

import { $, esc } from '../utils.js';

import { dashboard } from '../pages/dashboard.js';

import { agenda } from '../pages/agenda.js';
import { loadAgendaPage } from '../agenda/pages/agenda-page.js';

import { cardList } from '../pages/records.js';
import { customersPage, loadCustomersPage } from '../pages/customers.js';
import { professionalsPage, loadProfessionalsPage } from '../pages/professionals.js';
import { comandaPage, loadComandaPage } from '../pages/comanda.js';
import { quotesPage, loadQuotesPage } from '../pages/quotes.js';
import { servicesPage, loadServicesPage } from '../pages/services.js';
import { productsPage, loadProductsPage } from '../pages/products.js';
import { salesPage } from '../pages/sales.js';
import { cashPage, loadCashPage } from '../pages/cash.js';
import { financePage } from '../pages/finance.js';
import { commissionsPage, loadCommissionsPage } from '../pages/commissions.js';
import { reportsPage } from '../pages/reports.js';
import { branchesPage } from '../pages/branches.js';
import { teamPage, loadTeamPage } from '../pages/team.js';
import { recycleBinPage, loadRecycleBinPage } from '../pages/recycle-bin.js';

import { settings } from '../pages/settings.js';

import { renderDrawer } from '../components/drawer.js';

/**
 * Gera a navegação a partir dos grupos de menu configurados.
 * @returns {string} HTML dos itens de navegação.
 */
function renderNavigation() {
  return groups.map(group => {
    const [label, ...items] = group;
    const buttons = items.map(item => `
      <button title="${esc(item)}" aria-label="${esc(item)}"
        class="nav-item ${state.page === item ? "active" : ""}" data-page="${esc(item)}">
        <img src="./brand/identidade-visual/icones/${encodeURIComponent(glyph[item])}" alt="" loading="lazy">
        <span>${esc(item)}</span>
      </button>`).join("");
    return '<div class="nav-group-label">' + esc(label) + '</div>' + buttons;
  }).join("");
}

const pageViews = {
  Clientes: customersPage,
  Profissionais: professionalsPage,
  Comanda: comandaPage,
  Orçamentos: quotesPage,
  Serviços: servicesPage,
  "Produtos e estoque": productsPage,
  Vendas: salesPage,
  Caixa: cashPage,
  Financeiro: financePage,
  Comissões: commissionsPage,
  Relatórios: reportsPage,
  Unidades: branchesPage,
  "Equipe e permissões": teamPage,
  Recuperar: recycleBinPage
};

/** Resolve a função de página para a rota atual sem carregar dados demonstrativos. */
function renderCurrentPage() {
  if (state.page === "Dashboard") return dashboard();
  if (state.page === "Agenda") return agenda();
  if (state.page === "Configurações") return settings();
  return (pageViews[state.page] || (() => cardList(state.page)))();
}

/** Seletor de tenant aparece somente para contas com mais de uma organização ativa. */
function renderTenantControl() {
  const organizations = state.availableOrganizations || [];
  if (organizations.length <= 1) {
    return '<span class="unit-indicator">' + esc(state.organization?.name || "Meu Salão") + '</span>';
  }
  return '<label class="tenant-switcher"><span>Organização</span><select id="tenant-switcher" aria-label="Trocar organização">' +
    organizations.map(org => '<option value="' + esc(org.id) + '" ' +
      (org.id === state.organization?.id ? "selected" : "") + '>' + esc(org.name) + '</option>').join("") +
    '</select></label>';
}

/** Monta o shell administrativo com navegação, tenant ativo e conteúdo da rota. */
function renderApplicationShell(navigation, content) {
  $("#app").innerHTML = `
    <div class="mobile-scrim ${state.mobileMenu ? "visible" : ""}" data-action="close-menu"></div>
    <aside class="sidebar ${state.mobileMenu ? "open" : ""} ${state.sidebarCollapsed ? "collapsed" : ""}" id="sidebar">
      <div class="brand">
        <img src="./brand/identidade-visual/logo/SAL%C3%83O%20PREMIUN_20261111_231325_0003.png" alt="SALÃO PREMIUM" class="brand-logo">
        <div class="brand-copy"><b>SALÃO PREMIUM</b><small>GESTÃO INTELIGENTE</small></div>
        <button class="icon-btn sidebar-collapse" data-action="collapse-menu" aria-label="Recolher ou expandir menu" title="Recolher ou expandir menu">${state.sidebarCollapsed ? "›" : "‹"}</button>
        <button class="icon-btn sidebar-close" data-action="close-menu" aria-label="Fechar menu">×</button>
      </div>
      <nav class="main-nav">${navigation}</nav>
      <div class="sidebar-footer">
        <span class="avatar small">SP</span>
        <span><b>${esc(state.user?.email || "Salão Premium")}</b><small>Conta conectada</small></span>
      </div>
    </aside>
    <main class="main-area ${state.sidebarCollapsed ? "sidebar-collapsed" : ""}">
      <header class="topbar">
        <div class="topbar-left">
          <button class="icon-btn menu-toggle" data-action="toggle-menu" aria-label="Abrir menu">☰</button>
          <span class="breadcrumb">Painel <i>/</i> <b>${esc(state.page)}</b></span>
        </div>
        <div class="topbar-right">
          ${renderTenantControl()}
          <button class="icon-btn notification-btn" data-action="notifications" aria-label="Notificações">♧</button>
          <button class="icon-btn" data-action="sign-out" aria-label="Sair da conta" title="Sair da conta">↪</button>
        </div>
      </header>
      <section class="page-content">${content}</section>
    </main>
    <div id="drawer-root"></div>`;
}

/** Aciona somente o carregador do módulo que está visível na rota atual. */
function loadCurrentPageData() {
  const loaders = {
    Agenda: loadAgendaPage,
    Profissionais: loadProfessionalsPage,
    Comanda: loadComandaPage,
    Orçamentos: loadQuotesPage,
    Caixa: loadCashPage,
    Clientes: loadCustomersPage,
    Serviços: loadServicesPage,
    "Produtos e estoque": loadProductsPage,
    Recuperar: loadRecycleBinPage,
    Comissões: loadCommissionsPage,
    "Equipe e permissões": loadTeamPage
  };
  loaders[state.page]?.();
}

/** Renderiza shell, drawer, carregadores e eventos de navegação. */
export function render() {
  const navigation = renderNavigation();
  const content = renderCurrentPage();
  renderApplicationShell(navigation, content);
  renderDrawer();

  document.querySelectorAll("#sidebar .nav-item img").forEach(img => {
    img.addEventListener("error", () => { img.hidden = true; }, { once: true });
  });
  loadCurrentPageData();

  document.querySelectorAll("#sidebar .nav-item[data-page]").forEach(item => {
    item.addEventListener("click", event => {
      event.preventDefault();
      changePage(item.dataset.page);
    });
  });
}

/** Troca a rota e limpa filtros, menu móvel e drawer antes de renderizar a página nova. */
export function changePage(page) {
  state.page = page;
  state.query = "";
  state.mobileMenu = false;
  state.drawer = null;
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
}
