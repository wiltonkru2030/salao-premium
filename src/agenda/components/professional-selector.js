/** Componente: seletor de profissional. Responsabilidade: renderizar a seleção do profissional exibido na Agenda. */
import { esc } from '../../utils.js';
export function renderProfessionalSelector(selected, professionals=[]) {
  return '<div class="professional-strip" role="group" aria-label="Selecionar profissional">'+
    professionals.map((p,i)=>'<button type="button" class="professional-chip '+(selected===i?'selected':'')+'" data-pro="'+i+'" aria-pressed="'+(selected===i)+'"><span class="avatar">'+esc(p[0])+'</span><span><b>'+esc(p[1])+'</b><small>'+esc(p[2]||'Profissional')+'</small></span><span class="selection-dot"></span></button>').join('')+
    '</div>';
}
