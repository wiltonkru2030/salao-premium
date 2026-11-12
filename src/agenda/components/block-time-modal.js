import {pros} from '../../data/index.js';
import {esc} from '../../utils.js';
import {timeToMinutes,minutesToTime} from '../utils/duration.utils.js';
export function renderBlockTimeFields({date='',time='09:00',pro=0}={}){
 const end=minutesToTime(Math.min(timeToMinutes('20:00'),timeToMinutes(time)+60));
 return '<form class="agenda-form" data-block-time-form><label class="form-field"><span>Profissional</span><select name="pro">'+pros.map((p,i)=>'<option value="'+i+'" '+(i===pro?'selected':'')+'>'+esc(p[1])+'</option>').join('')+'</select></label><label class="form-field"><span>Data</span><input type="date" name="date" value="'+esc(date)+'" required></label><div class="agenda-form-row"><label class="form-field"><span>Início</span><input type="time" name="start" value="'+esc(time)+'" step="1800" required></label><label class="form-field"><span>Fim</span><input type="time" name="end" value="'+esc(end)+'" step="1800" required></label></div><label class="form-field"><span>Motivo</span><input name="reason" placeholder="Ex.: intervalo, compromisso" required></label><button class="btn primary full-width" type="submit">Bloquear horário</button><p class="demo-note">Bloqueio temporário nesta sessão. A API deverá validar e persistir a disponibilidade.</p></form>';
}
export function renderBlockTimeDrawer(){return '<div class="drawer-kicker">AGENDA · DISPONIBILIDADE</div><h2>Bloquear horário</h2><p class="drawer-description">Reserve um período para intervalo, compromisso ou indisponibilidade do profissional.</p>'}
