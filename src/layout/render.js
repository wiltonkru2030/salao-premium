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

export function render(){const nav=groups.map(g=>'<div class="nav-group-label">'+g[0]+'</div>'+g.slice(1).map(n=>'<button title="'+n+'" aria-label="'+n+'" class="nav-item '+(state.page===n?'active':'')+'" data-page="'+n+'"><img src="./brand/identidade-visual/icones/'+encodeURIComponent(glyph[n])+'" alt="" loading="lazy"><span>'+n+'</span></button>').join('')).join('');const pageViews={'Clientes':customersPage,'Profissionais':professionalsPage,'Comanda':comandaPage,'Orçamentos':quotesPage,'Serviços':servicesPage,'Produtos e estoque':productsPage,'Vendas':salesPage,'Caixa':cashPage,'Financeiro':financePage,'Comissões':commissionsPage,'Relatórios':reportsPage,'Unidades':branchesPage,'Equipe e permissões':teamPage,'Recuperar':recycleBinPage};const content=state.page==='Dashboard'?dashboard():state.page==='Agenda'?agenda():state.page==='Configurações'?settings():(pageViews[state.page]||(()=>cardList(state.page)))();$('#app').innerHTML='<div class="mobile-scrim '+(state.mobileMenu?'visible':'')+'" data-action="close-menu"></div><aside class="sidebar '+(state.mobileMenu?'open':'')+' '+(state.sidebarCollapsed?'collapsed':'')+'" id="sidebar"><div class="brand"><img src="./brand/identidade-visual/logo/SAL%C3%83O%20PREMIUN_20261111_231325_0003.png" alt="SALÃO PREMIUM" class="brand-logo"><div class="brand-copy"><b>SALÃO PREMIUM</b><small>GESTÃO INTELIGENTE</small></div><button class="icon-btn sidebar-collapse" data-action="collapse-menu" aria-label="Recolher ou expandir menu" title="Recolher ou expandir menu">'+(state.sidebarCollapsed?'›':'‹')+'</button><button class="icon-btn sidebar-close" data-action="close-menu" aria-label="Fechar menu">×</button></div><nav class="main-nav">'+nav+'</nav><div class="sidebar-footer"><span class="avatar small">SP</span><span><b>'+esc(state.user?.email||'Salão Premium')+'</b><small>Conta conectada</small></span></div></aside><main class="main-area '+(state.sidebarCollapsed?'sidebar-collapsed':'')+'"><header class="topbar"><div class="topbar-left"><button class="icon-btn menu-toggle" data-action="toggle-menu" aria-label="Abrir menu">☰</button><span class="breadcrumb">Painel <i>/</i> <b>'+esc(state.page)+'</b></span></div><div class="topbar-right">'+((state.availableOrganizations||[]).length>1?'<label class="tenant-switcher"><span>Organização</span><select id="tenant-switcher" aria-label="Trocar organização">'+state.availableOrganizations.map(org=>'<option value="'+esc(org.id)+'" '+(org.id===state.organization?.id?'selected':'')+'>'+esc(org.name)+'</option>').join('')+'</select></label>':'<span class="unit-indicator">'+esc(state.organization?.name||'Meu Salão')+'</span>')+'<button class="icon-btn notification-btn" data-action="notifications" aria-label="Notificações">♧</button><button class="icon-btn" data-action="sign-out" aria-label="Sair da conta" title="Sair da conta">↪</button></div></header><section class="page-content">'+content+'</section></main><div id="drawer-root"></div>';renderDrawer();document.querySelectorAll("#sidebar .nav-item img").forEach(img=>img.addEventListener("error",()=>{img.hidden=true;},{once:true}));if(state.page==='Agenda')loadAgendaPage();if(state.page==='Profissionais')loadProfessionalsPage();if(state.page==='Comanda')loadComandaPage();if(state.page==='Orçamentos')loadQuotesPage();if(state.page==='Caixa')loadCashPage();if(state.page==='Clientes')loadCustomersPage();if(state.page==='Serviços')loadServicesPage();if(state.page==='Produtos e estoque')loadProductsPage();if(state.page==='Recuperar')loadRecycleBinPage();if(state.page==='Comissões')loadCommissionsPage();if(state.page==='Equipe e permissões')loadTeamPage();document.querySelectorAll('#sidebar .nav-item[data-page]').forEach(item=>item.addEventListener('click',event=>{event.preventDefault();changePage(item.dataset.page)}))}

export function changePage(page){state.page=page;state.query='';state.mobileMenu=false;state.drawer=null;render();window.scrollTo({top:0,behavior:'instant'})}
