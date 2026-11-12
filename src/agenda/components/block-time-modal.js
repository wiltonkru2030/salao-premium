import {pros} from '../../data/index.js';
import {esc} from '../../utils.js';
export function renderBlockTimeFields({date='',time='09:00',pro=0}={}){
 return '<form class="agenda-form" data-block-time-form>'+
 '<label class="form-field"><span>Profissional</span><select name="pro">'+pros.map((p,i)=>'<option value="'+i+'" '+(i===pro?'selected':'')+'>'+esc(p[1])+'</option>').join('')+'</select></label>'+
 '<label class="form-field"><span>Data</span><input type="date" name="date" value="'+esc(date)+'" required></label>'+
 '<div class="agenda-form-row"><label class="form-field"><span>Início</span><input type="time" name="start" value="'+esc(time)+'" step="1800" required></label><label class="form-field"><span>Fim</span><input type="time" name="end" value="'+esc(time==='19:30'?'20:00':String(Math.min(23,Number(time.slice(0,2))+1)).padStart(2,'0')+time.slice(2))+'" step="1800" required></label></div>'+
 '<label class="form-field"><span>Motivo</span><input name="reason" placeholder="Ex.: intervalo, compromisso" required></label>'+
 '<button class="btn primary full-width" type="submit">Bloquear horário</button>'+
 '<p class="demo-note">Bloqueio temporário nesta sessão. A API deverá validar e persistir a disponibilidade.</p></form>';
}