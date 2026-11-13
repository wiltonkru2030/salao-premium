/** Páginas genéricas demonstrativas. Não representam módulos com persistência real. */
import { state } from '../state.js';
import { records } from '../data/index.js';
import { head, btn, esc, status, initials } from '../utils.js';
export function cardList(name){let data=records[name]||[];const q=state.query.toLocaleLowerCase('pt-BR');data=data.filter(r=>r.join(' ').toLocaleLowerCase('pt-BR').includes(q));const titleMap={'Clientes':'clientes','Profissionais':'profissionais','Serviços':'serviços','Produtos e estoque':'produtos','Vendas':'vendas','Caixa':'movimentações','Financeiro':'lançamentos','Comissões':'comissões','Relatórios':'indicadores','Unidades':'unidades','Equipe e permissões':'perfis'};let h=head(name,'Consulte e organize '+
(titleMap[name]||name.toLowerCase())+
' da sua unidade.');h+='<div class="list-toolbar">
<label class="search-box">
<span>⌕</span>
<input id="record-search" value="'+esc(state.query)+
'" placeholder="Buscar '+esc(name.toLowerCase())+
'..." />
</label>
<select class="field compact" data-filter>
<option>Todos</option>
<option>Ativo</option>
<option>Em estoque</option>
<option>Estoque baixo</option>
<option>Concluída</option>
<option>Pendente</option>
</select>
<span class="result-count">'+data.length+
' registros</span>
</div>
<div class="record-list">'+data.map((r,i)=>'<button class="record-card" data-record="'+
(records[name]||[]).indexOf(r)+
'" data-record-type="'+esc(name)+
'">
<span class="avatar record-avatar">'+esc(r[1]||initials(r[0]))+
'</span>
<span class="record-main">
<b>'+esc(r[0])+
'</b>
<small>'+esc(r[2]||r[3]||'')+
'</small>
<small>'+esc(r[3]||r[4]||'')+
'</small>
</span>
<span class="record-trailing">
<b>'+esc(r[4]&&/R\\$|atendimentos|clientes/.test(r[4])?r[4]:r[3]||'')+
'</b>'+status(r[r.length-1])+
'</span>
<span class="record-chevron">›</span>
</button>').join('')+
(data.length?'':'<div class="empty-state">
<span>⌕</span>
<b>Nenhum registro encontrado</b>
<small>Tente outro termo de busca.</small>
</div>')+
'</div>
<p class="demo-note">Dados fictícios para validação visual · toque em qualquer registro para abrir suas propriedades.</p>';return h}
