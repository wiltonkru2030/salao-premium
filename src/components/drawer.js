import {state} from '../state.js';
import {records} from '../data/index.js';
import {$,esc,field,btn} from '../utils.js';
import {dateKey} from '../agenda/utils/date.utils.js';
import {renderAppointmentDrawer} from '../agenda/components/appointment-drawer.js';
import {renderBlockTimeFields,renderBlockTimeDrawer} from '../agenda/components/block-time-modal.js';

function openDrawer(data){
 state.drawer={...data,date:dateKey(state.date)};state.drawerLoading=true;renderDrawer();
 setTimeout(()=>{if(state.drawer&&state.drawer.title===data.title){state.drawerLoading=false;renderDrawer()}},120);
}
function recordDrawer(type,index){
 const r=(records[type]||[])[index];if(!r)return;
 openDrawer({kind:'record',title:r[0],type,fields:r.slice(2).map((v,i)=>({label:(['Informação','Detalhes','Valor / situação'][i]||'Detalhe'),value:v}))});
}
function appointmentDrawer(a){openDrawer({kind:'appointment',appointment:a?{...a}:null,title:a?'Propriedades do agendamento':'Novo agendamento',slot:a?.time||'',pro:a?.pro??state.pro,editing:!a})}
function renderDrawer(){
 const root=$('#drawer-root');if(!root)return;
 if(!state.drawer){root.innerHTML='';return}
 if(state.drawerLoading){root.innerHTML='<div class="drawer-backdrop"></div><aside class="detail-drawer loading-drawer"><div class="drawer-loading"><span class="loading-spinner"></span><small>Carregando informações…</small></div></aside>';return}
 const d=state.drawer;let body='';
 if(d.kind==='appointment')body=renderAppointmentDrawer(d);
 else if(d.kind==='block')body=renderBlockTimeDrawer(d)+renderBlockTimeFields({date:d.date||dateKey(state.date),time:d.slot||'09:00',pro:d.pro??state.pro});
 else body='<div class="drawer-kicker">'+esc(d.type||'CADASTRO')+' · PROPRIEDADES</div><h2>'+esc(d.title)+'</h2><p class="drawer-description">Informações deste registro.</p><div class="drawer-section"><h3>Detalhes</h3>'+((d.fields||[]).map(f=>field(f.label,f.value)).join(''))+'</div><p class="demo-note">A edição dos cadastros será conectada ao banco de dados posteriormente.</p>';
 root.innerHTML='<div class="drawer-backdrop" data-action="close-drawer"></div><aside class="detail-drawer" role="dialog" aria-modal="true" aria-label="'+esc(d.title)+'"><div class="drawer-top"><span class="drawer-brand">SALÃO PREMIUM</span><button class="icon-btn close-drawer" data-action="close-drawer" aria-label="Fechar painel">×</button></div><div class="drawer-content">'+body+'</div><div class="drawer-bottom">'+btn('Fechar','close-drawer')+'</div></aside>';
}
export {openDrawer,recordDrawer,appointmentDrawer,renderDrawer};
