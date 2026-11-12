import {pros,records} from '../../data/index.js';
import {esc} from '../../utils.js';
export function renderAppointmentForm({appointment=null,date='',time='',pro=0}={}){
 const a=appointment||{};
 const customers=(records.Clientes||[]).map(r=>r[0]);
 const services=(records.Serviços||[]).map(r=>r[0]);
 const selectedDate=a.date||date;
 const selectedTime=a.time||time||'09:00';
 const selectedPro=a.pro??pro;
 return '<form class="agenda-form" data-agenda-form>'+
 '<label class="form-field"><span>Cliente</span><input name="name" list="agenda-customers" value="'+esc(a.name||'')+'" placeholder="Nome do cliente" required><datalist id="agenda-customers">'+customers.map(x=>'<option value="'+esc(x)+'"></option>').join('')+'</datalist></label>'+
 '<label class="form-field"><span>Telefone</span><input name="phone" type="tel" value="'+esc(a.phone||'')+'" placeholder="(00) 00000-0000"></label>'+
 '<label class="form-field"><span>Serviço</span><input name="service" list="agenda-services" value="'+esc(a.service||'')+'" placeholder="Nome do serviço" required><datalist id="agenda-services">'+services.map(x=>'<option value="'+esc(x)+'"></option>').join('')+'</datalist></label>'+
 '<label class="form-field"><span>Profissional</span><select name="pro">'+pros.map((p,i)=>'<option value="'+i+'" '+(i===selectedPro?'selected':'')+'>'+esc(p[1])+'</option>').join('')+'</select></label>'+
 '<div class="agenda-form-row"><label class="form-field"><span>Data</span><input name="date" type="date" value="'+esc(selectedDate)+'" required></label><label class="form-field"><span>Horário</span><input name="time" type="time" step="1800" value="'+esc(selectedTime)+'" required></label></div>'+
 '<div class="agenda-form-row"><label class="form-field"><span>Duração (minutos)</span><input name="duration" type="number" min="5" max="720" step="5" value="'+esc(a.duration||60)+'" required></label><label class="form-field"><span>Valor (R$)</span><input name="price" value="'+esc(String(a.price||'').replace(/^R\$\s*/,''))+'" placeholder="0,00"></label></div>'+
 '<label class="form-field"><span>Status</span><select name="status">'+['Aguardando','Confirmado','Em atendimento','Finalizado','Cancelado','Falta'].map(x=>'<option '+((a.status||'Aguardando')===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label>'+
 '<label class="form-field"><span>Observações</span><textarea name="notes" rows="2" placeholder="Informações adicionais">'+esc(a.notes||'')+'</textarea></label>'+
 '<button class="btn primary full-width" type="submit">'+(a.id?'Atualizar agendamento':'Criar agendamento')+'</button>'+
 '<p class="demo-note">Alterações ficam apenas nesta sessão de demonstração e não são sincronizadas.</p></form>';
}