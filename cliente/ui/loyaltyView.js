/** Visualização de relacionamento por salão, sem recompensas ou descontos presumidos. */
import {escapeClientHtml} from "./view-utils.js";
const esc=value=>escapeClientHtml(String(value??""));
const money=value=>Number(value).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
/** Renderiza informações de atendimentos e recebimentos vinculados à conta. */
export function renderLoyaltyView({items=[],loading=false,error=""}={}){
 return '<section class="page-content"><div class="page-heading"><span class="eyebrow">MINHA CONTA</span>'+
 '<h1>Meu relacionamento com os salões</h1><p>Acompanhe seus atendimentos e pagamentos registrados em cada estabelecimento.</p></div>'+
 '<button class="client-button secondary" type="button" data-action="back-profile">Voltar ao perfil</button>'+
 (loading?'<p class="client-note">Consultando seus registros…</p>':'')+
 (error?'<div class="client-alert error" role="alert">'+esc(error)+'</div>':'')+
 '<div class="loyalty-list">'+(items.length?items.map(row=>
 '<article class="detail-card loyalty-card"><h2>'+esc(row.salonName)+'</h2>'+
 '<div class="loyalty-metrics"><div><strong>'+esc(row.completedAppointments)+'</strong><span>Atendimentos concluídos</span></div>'+
 '<div><strong>'+esc(row.paidOrders)+'</strong><span>Comandas quitadas</span></div>'+
 '<div><strong>'+esc(money(row.totalPaid))+'</strong><span>Recebimentos confirmados</span></div></div>'+
 (row.lastPaidAt?'<p>Último recebimento: '+esc(formatDate(row.lastPaidAt))+'</p>':'')+
 '</article>').join(""):(!loading?'<div class="detail-card"><p>Ainda não há atendimentos vinculados à sua identidade global.</p></div>':''))+'</div>'+
 '<p class="client-note">Esses dados representam seu histórico real. Pontos, benefícios e descontos de fidelidade só estarão disponíveis quando cada salão configurar e ativar as regras correspondentes.</p>'+
 '<button class="client-button" type="button" data-action="reload-loyalty">Atualizar histórico</button></section>';
}
function formatDate(value){
 const d=new Date(value);
 return Number.isFinite(d.getTime())?new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium"}).format(d):"Data não disponível";
}
