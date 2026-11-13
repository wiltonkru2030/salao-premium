/** Componente: filtros da Agenda. Responsabilidade: renderizar busca textual e filtro por status. */
export function renderAgendaFilters({query='',filter='Todos'}={}){
 return '<div class="agenda-filters" aria-label="Filtros da agenda">
<label class="agenda-search">
<span>⌕</span>
<input type="search" data-agenda-search placeholder="Buscar cliente, serviço ou telefone" value="'+String(query).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+'">
</label>
<select class="field compact" data-agenda-filter aria-label="Filtrar por status">'+['Todos','Aguardando','Confirmado','Em atendimento','Finalizado','Cancelado','Falta'].map(x=>'<option '+(filter===x?'selected':'')+'>'+x+'</option>').join('')+'</select>
</div>';
}
