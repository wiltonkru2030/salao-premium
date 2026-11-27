/** Configurações semanais em cartões e formulários; suporta intervalos separados para almoço. */
import {escapeHtml as esc} from "../utils/formatters.js";
const days=["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];
function form(row={}){
 const id=esc(row.id||"");
 return '<form data-own-hours-form data-id="'+id+'" class="professional-settings-card"><label class="sp-labeled-field">Dia da semana<select name="weekday" required>'+days.map((d,i)=>'<option value="'+i+'"'+(Number(row.weekday??1)===i?' selected':'')+'>'+d+'</option>').join("")+'</select></label><label class="sp-labeled-field">Início<input type="time" name="startsAt" required value="'+esc(String(row.starts_at||"").slice(0,5))+'"></label><label class="sp-labeled-field">Fim<input type="time" name="endsAt" required value="'+esc(String(row.ends_at||"").slice(0,5))+'"></label><p role="alert" data-hours-error hidden></p><div class="professional-card-actions"><button type="submit" class="btn primary">'+(id?"Salvar alteração":"Adicionar horário")+'</button>'+(id?'<button type="button" class="btn secondary" data-remove-own-hours="'+id+'">Excluir</button>':'')+'</div></form>';
}
export function renderOwnWorkingHours(state){
 const status=state.workingHoursStatus||"idle",rows=state.workingHours||[];
 return '<section class="detail sp-content-surface professional-settings-card professional-control-stack"><h3>Meu expediente</h3><p class="muted">Configure seus dias e horários de trabalho. Para almoço, cadastre dois intervalos separados. As reservas também respeitam o expediente da unidade, folgas e bloqueios.</p>'+
 (status==="loading"?'<p role="status">Carregando horários…</p>':status!=="ready"?'<button type="button" class="btn secondary" data-action="load-own-hours">'+(status==="error"?"Tentar novamente":"Carregar expediente")+'</button>':(rows.length?rows.map(row=>'<details><summary>'+days[row.weekday]+' · '+esc(String(row.starts_at).slice(0,5))+' às '+esc(String(row.ends_at).slice(0,5))+(row.active?"":" · Inativo")+'</summary>'+form(row)+'</details>').join(""):'<p class="muted">Nenhum expediente cadastrado.</p>')+'<details open><summary>Adicionar horário</summary>'+form()+'</details>')+'</section>';
}
