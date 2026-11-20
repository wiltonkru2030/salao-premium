/** Compositor do painel. Responsabilidade: montar menu, cabeçalho, conteúdo da rota e disparar carregadores de cada módulo. */
import { groups, glyph } from '../data/index.js';

import { state } from '../state.js';

import { $, esc } from '../utils.js';

import { dashboard, loadDashboard } from '../pages/dashboard.js';

import { agenda } from '../pages/agenda.js';
import { loadAgendaPage } from '../agenda/pages/agenda-page.js';

import { cardList } from '../pages/records.js';
import { customersPage, loadCustomersPage } from '../pages/customers.js';
import { professionalsPage, loadProfessionalsPage } from '../pages/professionals.js';
import { comandaPage, loadComandaPage } from '../pages/comanda.js';
import { quotesPage, loadQuotesPage } from '../pages/quotes.js';
import { couponsPage, loadCouponsPage } from '../pages/coupons.js';
import { servicesPage, loadServicesPage } from '../pages/services.js';
import { productsPage, loadProductsPage } from '../pages/products.js';
import { categoriesPage, loadCategoriesPage } from '../pages/categories.js';
import { salesPage, loadSalesPage } from '../pages/sales.js';
import { cashPage, loadCashPage } from '../pages/cash.js';
import { financePage, loadFinancePage } from '../pages/finance.js';
import { expensesPage, loadExpensesPage } from '../pages/expenses.js';
import { commissionsPage, loadCommissionsPage } from '../pages/commissions.js';
import { reportsPage, loadReportsPage, bindReportsPage } from '../pages/reports.js';
import { branchesPage, loadBranchesPage } from '../pages/branches.js';
import { teamPage, loadTeamPage } from '../pages/team.js';
import { recycleBinPage, loadRecycleBinPage } from '../pages/recycle-bin.js';

import { settings, loadSettingsPage } from '../pages/settings.js';

import { renderDrawer } from '../components/drawer.js';

/** Módulos disponíveis no App Profissional; o banco continua impondo as permissões reais via RLS/RPC. */
const PROFESSIONAL_APP_PAGES = new Set(["Agenda", "Comanda", "Comissões", "Configurações"]);

/** Impede que o perfil profissional navegue para módulos administrativos pela interface. */
function canOpenCurrentPage(page) {
  return state.membership?.role !== "professional" || PROFESSIONAL_APP_PAGES.has(page);
}

/**
 * Gera a navegação a partir dos grupos de menu e filtra módulos pelo perfil ativo.
 * @returns {string} HTML dos itens de navegação autorizados para a interface.
 */
function renderNavigation() {
  const visibleGroups = groups.map(([label, ...items]) => [label, ...items.filter(item => canOpenCurrentPage(item))]).filter(group => group.length > 1);
  return visibleGroups.map(group => {
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
  Cupons: couponsPage,
  Serviços: servicesPage,
  "Produtos e estoque": productsPage,
  Categorias: categoriesPage,
  Vendas: salesPage,
  Caixa: cashPage,
  Financeiro: financePage,
  Despesas: expensesPage,
  Comissões: commissionsPage,
  Relatórios: reportsPage,
  Unidades: branchesPage,
  "Equipe e permissões": teamPage,
  Recuperar: recycleBinPage
};

/** Resolve a função de página para a rota atual sem carregar dados demonstrativos. */
function renderCurrentPage() {
  if (!canOpenCurrentPage(state.page)) state.page = "Agenda";
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

/** Seletor de unidade física; a organização continua sendo o limite principal do tenant. */
function renderBranchControl() {
  const branches=state.availableBranches||[];
  if(!branches.length)return "";
  if(branches.length===1) {
    return '<span class="unit-indicator">'+esc(branches[0].name)+'</span>';
  }
  if(state.membership?.role==="professional") {
    return '<span class="unit-indicator">'+esc(state.branch?.name||"Unidade vinculada")+'</span>';
  }
  return '<label class="branch-switcher"><span>Unidade</span><select id="branch-switcher" aria-label="Trocar unidade">'+
    branches.map(branch=>'<option value="'+esc(branch.id)+'" '+(branch.id===state.branch?.id?"selected":"")+'>'+
      esc(branch.name)+(branch.is_main?" · Matriz":"")+'</option>').join("")+
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
          ${renderBranchControl()}
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
    Dashboard: loadDashboard,
    Agenda: loadAgendaPage,
    Profissionais: loadProfessionalsPage,
    Comanda: loadComandaPage,
    Orçamentos: loadQuotesPage,
    Cupons: loadCouponsPage,
    Caixa: loadCashPage,
    Financeiro: loadFinancePage,
    Despesas: loadExpensesPage,
    Clientes: loadCustomersPage,
    Serviços: loadServicesPage,
    "Produtos e estoque": loadProductsPage,
    Categorias: loadCategoriesPage,
    Vendas: loadSalesPage,
    Recuperar: loadRecycleBinPage,
    Comissões: loadCommissionsPage,
    Relatórios: () => { bindReportsPage(); loadReportsPage(); },
    "Equipe e permissões": loadTeamPage,
    Unidades: loadBranchesPage,
    Configurações: loadSettingsPage
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
  if (!canOpenCurrentPage(page)) {
    state.page = "Agenda";
    return render();
  }
  state.page = page;
  state.query = "";
  state.mobileMenu = false;
  state.drawer = null;
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
}
