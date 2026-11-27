/** Catálogo profissional: pesquisa, cadastro e vínculos usando componentes globais. */
import {escapeHtml as esc,formatMoney} from "../utils/formatters.js";

/** Formulário de edição para serviços autorizados, com máscara monetária global. */
function editorView(editor,catalog){
 const categories=[...new Set(catalog.map(row=>row.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
 return '<section class="detail sp-content-surface"><div class="section-title"><h2>'+(editor.id?"Editar serviço":"Novo serviço")+'</h2></div>'+
 '<form id="professional-service-form"><label class="sp-labeled-field">Nome<input name="name" required minlength="2" maxlength="120" value="'+esc(editor.name||"")+'"></label>'+
 '<label class="sp-labeled-field">Categoria<input name="category" list="professional-service-categories" maxlength="100" value="'+esc(editor.category||"")+'"></label><datalist id="professional-service-categories">'+categories.map(category=>'<option value="'+esc(category)+'"></option>').join("")+'</datalist>'+
 '<label class="sp-labeled-field">Duração em minutos<input name="minutes" type="number" min="1" max="1440" step="1" required value="'+esc(editor.duration_minutes??30)+'"></label>'+
 '<label class="sp-labeled-field">Valor<input name="price" inputmode="decimal" data-mask="currency" required value="'+esc(formatMoney(editor.price??0))+'"></label>'+
 '<p role="alert" data-service-save-error hidden></p><div class="professional-card-actions"><button type="button" class="btn secondary" data-action="cancel-professional-service">Cancelar</button><button type="submit" class="btn primary">Salvar serviço</button></div></form></section>';
}
/** Renderiza catálogo e vínculo; sem contrato habilitado mantém a consulta anterior. */
export function renderProfessionalServices(services,{manage=false,catalog=[],editor=null,status="idle"}={}){
 if(manage&&editor)return editorView(editor,catalog);
 const title='<div class="section-title"><h2 id="professional-services-heading">Serviços</h2></div>';
 if(manage&&(status==="loading"||status==="idle"))return title+'<p role="status" class="muted">Carregando serviços...</p>';
 if(manage&&status==="error")return title+'<p role="alert">Não foi possível carregar o catálogo.</p><button class="btn secondary" data-action="refresh-professional-services">Tentar novamente</button>';
 const rows=(manage?catalog:services).map(service=>{
  const search=[service.name,service.category,service.duration_minutes+" min",service.price,formatMoney(service.price),manage?(service.linked?"Vinculado":"Disponível"):""].filter(value=>value!=null).join(" ");
  return '<article class="detail sp-content-surface" data-professional-search-text="'+esc(search)+'"><div class="professional-service-record"><div class="record-main"><strong>'+esc(service.name)+'</strong><p class="meta">'+esc(service.category||"Serviço")+' · '+esc(service.duration_minutes)+' min</p></div><b class="professional-service-price">'+esc(formatMoney(service.price))+'</b></div>'+
  (manage?'<span class="tag">'+(service.linked?"Vinculado":"Disponível")+'</span><div class="professional-card-actions">'+(service.editable?'<button type="button" class="btn secondary" data-service-edit="'+esc(service.id)+'">Editar</button>':"")+'<button type="button" class="btn secondary" data-service-link="'+esc(service.id)+'">'+(service.linked?"Remover vínculo":"Vincular serviço")+'</button></div>':"")+'</article>';
 }).join("");
 return '<section data-professional-list aria-labelledby="professional-services-heading">'+title+
 (manage?'<button type="button" class="btn primary" data-action="new-professional-service">+ Novo serviço</button><p class="muted">Vincule os serviços que realiza. Serviços compartilhados são editados pelo salão.</p>':"")+
 '<label class="sp-labeled-field">Buscar serviço<input type="search" data-professional-list-search placeholder="Nome, categoria ou valor"></label>'+
 '<p class="empty sp-content-surface sp-content-surface--empty" data-professional-search-empty hidden>Nenhum serviço encontrado.</p>'+
 (rows||'<p class="empty sp-content-surface sp-content-surface--empty">Nenhum serviço disponível.</p>')+'</section>';
}
