import { groups, glyph } from '../data/index.js';

import { state } from '../state.js';

import { $, esc } from '../utils.js';

import { dashboard } from '../pages/dashboard.js';

import { agenda } from '../pages/agenda.js';

import { cardList } from '../pages/records.js';
import { customersPage } from '../pages/customers.js';
import { professionalsPage } from '../pages/professionals.js';
import { servicesPage } from '../pages/services.js';
import { productsPage } from '../pages/products.js';
import { salesPage } from '../pages/sales.js';
import { cashPage } from '../pages/cash.js';
import { financePage } from '../pages/finance.js';
import { commissionsPage } from '../pages/commissions.js';
import { reportsPage } from '../pages/reports.js';
import { branchesPage } from '../pages/branches.js';
import { teamPage } from '../pages/team.js';

import { settings } from '../pages/settings.js';

import { renderDrawer } from '../components/drawer.js';

export function render(){const nav=groups.map(g=>'<div class="nav-group-label">'+g[0]+'</div>'+g.slice(1).map(n=>'<button class="nav-item '+(state.page===n?'active':'')+'" data-page="'+n+'"><img src="./brand/identidade-visual/icones/'+encodeURIComponent(glyph[n])+'" alt="" loading="lazy" onerror="this.style.display=\'none\'"><span>'+n+'</span></button>').join('')).join('');const pageViews={'Clientes':customersPage,'Profissionais':professionalsPage,'Serviços':servicesPage,'Produtos e estoque':productsPage,'Vendas':salesPage,'Caixa':cashPage,'Financeiro':financePage,'Comissões':commissionsPage,'Relatórios':reportsPage,'Unidades':branchesPage,'Equipe e permissões':teamPage};const content=state.page==='Dashboard'?dashboard():state.page==='Agenda'?agenda():state.page==='Configurações'?settings():(pageViews[state.page]||(()=>cardList(state.page)))();$('#app').innerHTML='<div class="mobile-scrim '+(state.mobileMenu?'visible':'')+'" data-action="close-menu"></div><aside class="sidebar '+(state.mobileMenu?'open':'')+'" id="sidebar"><div class="brand"><img src="./brand/identidade-visual/logo/SAL%C3%83O%20PREMIUN_20261111_231325_0003.png" alt="SALÃO PREMIUM" class="brand-logo"><div><b>SALÃO PREMIUM</b><small>GESTÃO INTELIGENTE</small></div><button class="icon-btn sidebar-close" data-action="close-menu" aria-label="Fechar menu">×</button></div><nav class="main-nav">'+nav+'</nav><div class="sidebar-footer"><span class="avatar small">SP</span><span><b>Salão Premium</b><small>Ambiente de demonstração</small></span></div></aside><main class="main-area"><header class="topbar"><div class="topbar-left"><button class="icon-btn menu-toggle" data-action="toggle-menu" aria-label="Abrir menu">☰</button><span class="breadcrumb">Painel <i>/</i> <b>'+esc(state.page)+'</b></span></div><div class="topbar-right"><span class="unit-indicator">Unidade Matriz</span><button class="icon-btn notification-btn" data-action="notifications" aria-label="Notificações">♧</button></div></header><section class="page-content">'+content+'</section></main><div id="drawer-root"></div>';renderDrawer();document.querySelectorAll('#sidebar .nav-item[data-page]').forEach(item=>item.addEventListener('click',event=>{event.preventDefault();changePage(item.dataset.page)}))}

export function changePage(page){state.page=page;state.query='';state.mobileMenu=false;state.drawer=null;render();window.scrollTo({top:0,behavior:'instant'})}
