/** Utilitários visuais e de segurança de interface: seleção DOM, escape HTML, toast e componentes simples. */
import { state } from './state.js';
export const $=s=>document.querySelector(s);
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function toast(msg){const el=document.createElement('div');el.className='toast';el.textContent=msg;document.body.append(el);setTimeout(()=>el.remove(),2600)}
export function icon(name){return '<span class="ui-icon" aria-hidden="true">'+name+'</span>'}
export function btn(label,action,kind='secondary'){return '<button type="button" class="btn '+kind+'" data-action="'+action+'">'+label+'</button>'}
export function head(title,desc,action=''){return '<div class="page-head"><div><div class="eyebrow">SALÃO PREMIUM <span>/</span> '+esc(state.page.toUpperCase())+'</div><h1>'+esc(title)+'</h1><p>'+esc(desc)+'</p></div><div class="head-actions">'+action+'</div></div>'}
export function status(text){let cls=/confirmado|ativo|concluída|recebido|pago|entrada|frequente|vip/i.test(text)?'success':/cancel|baixo|pendente|aguardando|apurar|aberto/i.test(text)?'warning':'neutral';return '<span class="status '+cls+'">'+esc(text)+'</span>'}
export function metric(label,value,change,sub='em relação ao período anterior'){return '<article class="metric-card"><div class="metric-top"><span>'+esc(label)+'</span><span class="metric-mark">↗</span></div><strong>'+esc(value)+'</strong><small>'+esc(change)+' <span>'+esc(sub)+'</span></small></article>'}
export function initials(name){return name.split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase()}
export function field(label,value){return '<div class="property-row"><span>'+esc(label)+'</span><b>'+esc(value)+'</b></div>'}
