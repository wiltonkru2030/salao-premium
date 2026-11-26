/**
 * Utilitários visuais e de segurança de interface.
 * Responsabilidade: encapsular seleção DOM, escape HTML e componentes visuais reutilizáveis.
 * Segurança: valores dinâmicos inseridos em texto/atributos devem ser escapados antes da renderização.
 */

/** Localiza o primeiro elemento que corresponde ao seletor CSS informado. */
export const $=s=>document.querySelector(s);
/** Escapa caracteres especiais para impedir que texto dinâmico seja interpretado como HTML. */
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** Exibe uma notificação temporária e a remove automaticamente da interface. */
export function toast(msg) {
  let region = document.querySelector("#sp-toast-region");
  if (!region) {
    region = document.createElement("div");
    region.id = "sp-toast-region";
    region.setAttribute("role", "status");
    document.body.append(region);
  }

  const message = document.createElement("div");
  message.className = "toast";
  region.append(message);
  message.textContent = msg;
  setTimeout(() => message.remove(), 2600);
}
/** Gera o fragmento visual do ícone de interface identificado pelo nome informado. */
export function icon(name){return '<span class="ui-icon" aria-hidden="true">'+name+'</span>'}
/** Gera botão com ação delegada por atributo data-action para o controlador da aplicação. */
export function btn(label,action,kind='secondary'){return '<button type="button" class="btn '+kind+'" data-action="'+action+'">'+label+'</button>'}
/** Monta o cabeçalho padronizado da página com título, descrição e ações opcionais. */
export function head(title,desc,action=''){return '<div class="page-head"><div><h1>'+esc(title)+'</h1><p>'+esc(desc)+'</p></div>'+(action?'<div class="head-actions">'+action+'</div>':'')+'</div>'}
/** Converte um status em etiqueta visual; o texto é escapado antes de entrar no HTML. */
export function status(text){let cls=/confirmado|ativo|concluída|recebido|pago|entrada|frequente|vip/i.test(text)?'success':/cancel|baixo|pendente|aguardando|apurar|aberto/i.test(text)?'warning':'neutral';return '<span class="status '+cls+'">'+esc(text)+'</span>'}
/** Gera cartão de indicador com valor, variação e legenda contextual. */
export function metric(label,value,change,sub='em relação ao período anterior'){return '<article class="metric-card"><div class="metric-top"><span>'+esc(label)+'</span><span class="metric-mark">↗</span></div><strong>'+esc(value)+'</strong><small>'+esc(change)+' <span>'+esc(sub)+'</span></small></article>'}
/** Retorna até duas iniciais para avatar textual de pessoa ou profissional. */
export function initials(name){return name.split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase()}
/** Gera linha de propriedade com rótulo e valor escapados. */
export function field(label,value){return '<div class="property-row"><span>'+esc(label)+'</span><b>'+esc(value)+'</b></div>'}
