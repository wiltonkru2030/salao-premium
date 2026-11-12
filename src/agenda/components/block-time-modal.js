import { esc } from '../../utils.js';
import { timeToMinutes, minutesToTime } from '../utils/duration.utils.js';
import { state } from '../../state.js';

export function renderBlockTimeFields({date='',time='09:00',pro=null}={}) {
  const selected=pro||(state.agendaProfessionals||[])[state.pro]?.[3]||'';
  const end=minutesToTime(Math.min(timeToMinutes('20:00'),timeToMinutes(time)+60));
  const professionals=state.agendaProfessionals||[];
  return '<form class="agenda-form" data-block-time-form>'+
    '<label class="form-field"><span>Profissional</span><select name="professional_id">'+professionals.map(p=>'<option value="'+esc(p[3])+'" '+(p[3]===selected?'selected':'')+'>'+esc(p[1])+'</option>').join('')+'</select></label>'+
    '<label class="form-field"><span>Data</span><input type="date" name="date" value="'+esc(date)+'" required></label>'+
    '<div class="agenda-form-row"><label class="form-field"><span>Início</span><input type="time" name="start" value="'+esc(time)+'" step="300" required></label><label class="form-field"><span>Fim</span><input type="time" name="end" value="'+esc(end)+'" step="300" required></label></div>'+
    '<label class="form-field"><span>Motivo</span><input name="reason" placeholder="Ex.: intervalo, compromisso" required></label>'+
    '<button class="btn primary full-width" type="submit">Bloquear horário</button></form>';
}
export function renderBlockTimeDrawer(){
  return '<div class="drawer-kicker">AGENDA · DISPONIBILIDADE</div><h2>Bloquear horário</h2><p class="drawer-description">Reserve um período para intervalo, compromisso ou indisponibilidade do profissional. O bloqueio ficará registrado no banco.</p>';
}
