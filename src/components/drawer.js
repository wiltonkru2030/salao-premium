/** Componente Drawer administrativo. Responsabilidade: renderizar detalhes e formulários contextuais da Agenda e registros. */
import {state} from '../state.js';
import {$,esc,field,btn} from '../utils.js';
import {dateKey} from '../agenda/utils/date.utils.js';
import {renderAppointmentDrawer} from '../agenda/components/appointment-drawer.js';
import {mountAppointmentForm} from '../agenda/components/appointment-form.js';
import {renderBlockTimeFields,renderBlockTimeDrawer} from '../agenda/components/block-time-modal.js';

/**
 * Abre drawer com dados já carregados pela página, sem simular espera de rede.
 * @param {object} data Conteúdo e contexto do drawer.
 */
function openDrawer(data){
 state.drawer={...data,date:dateKey(state.date)};
 state.drawerLoading=false;
 renderDrawer();
}

/**
 * Exibe estado honesto para detalhes genéricos ainda não conectados a um repositório específico.
 * @param {string} type Tipo do cadastro.
 * @param {string} id Identificador recebido do cartão.
 */
function recordDrawer(type,id){
 openDrawer({
  kind:'record',
  title:'Detalhes do cadastro',
  type,
  fields:[{label:'Identificador',value:String(id||'Não informado')}],
  description:'A consulta detalhada deste cadastro precisa ser aberta pelo módulo correspondente.'
 });
}
function appointmentDrawer(a,options={}){const selectedProfessional=(state.agendaProfessionals||[])[state.pro];openDrawer({kind:'appointment',appointment:a?{...a}:null,title:a?'Propriedades do agendamento':'Novo agendamento',slot:a?.time||options.slot||'',pro:a?.professional_id||selectedProfessional?.[3]||'',editing:!a})}
function renderDrawer(){
 const root=$('#drawer-root');if(!root)return;
 if(!state.drawer){root.innerHTML='';return}
 if(state.drawerLoading){root.innerHTML='<div class="drawer-backdrop"></div><aside class="detail-drawer loading-drawer"><div class="drawer-loading"><span class="loading-spinner"></span><small>Carregando informações…</small></div></aside>';return}
 const d=state.drawer;let body='';
 if(d.kind==='appointment')body=renderAppointmentDrawer(d);
 else if(d.kind==='block')body=renderBlockTimeDrawer(d)+renderBlockTimeFields({date:d.date||dateKey(state.date),time:d.slot||'09:00',pro:d.pro??state.pro});
 else body='<div class="drawer-kicker">'+esc(d.type||'CADASTRO')+
' · PROPRIEDADES</div><h2>'+esc(d.title)+
'</h2><p class="drawer-description">'+esc(d.description||'Informações básicas deste registro.')+'</p><div class="drawer-section"><h3>Identificação</h3>'+((d.fields||[]).map(f=>field(f.label,f.value)).join(''))+
'</div><p class="client-note">Para editar ou consultar os demais dados, utilize a página específica deste cadastro. Nenhuma informação demonstrativa é exibida.</p>';
 root.innerHTML='<div class="drawer-backdrop" data-action="close-drawer"></div><aside class="detail-drawer" role="dialog" aria-modal="true" aria-label="'+esc(d.title)+
'"><div class="drawer-top"><span class="drawer-brand">SALÃO PREMIUM</span><button class="icon-btn close-drawer" data-action="close-drawer" aria-label="Fechar painel">×</button></div><div class="drawer-content">'+body+
'</div><div class="drawer-bottom">'+btn('Fechar','close-drawer')+
'</div></aside>';
 if(d.kind==='appointment'&&(d.editing||!d.appointment))mountAppointmentForm();
}
export {openDrawer,recordDrawer,appointmentDrawer,renderDrawer};
