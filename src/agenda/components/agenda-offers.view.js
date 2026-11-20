/**
 * Componentes de apresentação de combos e lista de espera.
 * Gera HTML escapado; não acessa sessão, DOM, rede ou regras de persistência.
 */
import {esc} from "../../utils.js";
const e=value=>esc(String(value??""));
const money=n=>Number(n||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const statusName={waiting:"Aguardando",contacted:"Contato realizado",booked:"Agendado",cancelled:"Cancelado"};
const selectOptions=(rows,selected="",placeholder="Selecione")=>
 '<option value="">'+e(placeholder)+'</option>'+
 rows.map(r=>'<option value="'+e(r.id)+'"'+(r.id===selected?' selected':'')+'>'+e(r.name)+'</option>').join("");
/** Estrutura geral com abas, mensagem de estado e conteúdo da unidade. */
export function renderAgendaOffers({tab="waitlist",loading=false,error="",waitlist=[],matches=[],packages=[],services=[],professionals=[],isManager=false,date="",searched=false}={}){
 return '<div class="agenda-offers-head"><div><h2>Pacotes e lista de espera</h2><p>Organize ofertas e acompanhe solicitações de encaixe da unidade.</p></div></div>'+
 '<div class="agenda-offers-tabs" role="group" aria-label="Módulos complementares da Agenda">'+
 '<button type="button" class="btn '+(tab==="waitlist"?"primary":"secondary")+'" data-offer-tab="waitlist">Lista de espera</button>'+
 '<button type="button" class="btn '+(tab==="packages"?"primary":"secondary")+'" data-offer-tab="packages">Pacotes e combos</button></div>'+
 (error?'<p class="offer-error" role="alert">'+e(error)+'</p>':'')+
 (loading?'<p class="offer-loading">Consultando informações da unidade…</p>':'')+
 (tab==="packages"?renderPackages({packages,services,isManager}):renderWaitlist({waitlist,matches,services,professionals,date,searched}));
}
/** Lista os pedidos em ordem de criação e permite consultar vagas sem reserva automática. */
export function renderWaitlist({waitlist=[],matches=[],services=[],professionals=[],date="",searched=false}={}){
 return '<div class="offer-toolbar"><button class="btn primary" type="button" data-offer-action="new-waitlist">＋ Adicionar à lista</button>'+
 '<div class="offer-date"><label for="offer-match-date">Vagas para o dia</label><input id="offer-match-date" type="date" value="'+e(date)+'"><button type="button" class="btn secondary" data-offer-action="search-openings">Buscar encaixes</button></div></div>'+
 (searched?'<div class="offer-matches"><h3>Horários encontrados</h3>'+
 (matches.length?'<div class="offer-match-grid">'+matches.map((m,i)=>
 '<button type="button" class="offer-match" data-offer-action="preview-match" data-match-index="'+i+'">'+
 '<strong>'+e(m.customer_name)+'</strong><span>'+e(m.service_name)+' · '+e(m.professional_name||"Profissional")+'</span>'+
 '<small>'+e(formatTime(m.starts_at))+' · Clique para conferir e agendar</small></button>').join("")+'</div>':
 '<p>Nenhuma vaga compatível encontrada. Confira a publicação da unidade, o expediente e os bloqueios.</p>')+'</div>':'')+
 '<div class="offer-list"><h3>Solicitações ('+waitlist.length+')</h3>'+
 (waitlist.length?waitlist.map(w=>
 '<article class="offer-record"><div><strong>'+e(w.customer_name)+'</strong><p>'+e(w.service_name)+' · '+e(w.professional_name||"Qualquer profissional")+'</p>'+
 '<small>De '+e(formatDate(w.preferred_from))+' até '+e(formatDate(w.preferred_until))+
 ' · '+e(formatClock(w.time_from))+'–'+e(formatClock(w.time_until))+'</small>'+
 (w.notes?'<p class="offer-notes">'+e(w.notes)+'</p>':'')+'</div><div class="offer-record-actions"><span>'+e(statusName[w.status]||"Situação desconhecida")+'</span>'+
 (w.status==="waiting"?'<button type="button" class="btn secondary" data-offer-action="contacted" data-waitlist-id="'+e(w.waitlist_id)+'">Marcar contato</button>':'')+
 (["waiting","contacted"].includes(w.status)?'<button type="button" class="btn secondary" data-offer-action="cancel" data-waitlist-id="'+e(w.waitlist_id)+'">Cancelar solicitação</button>':'')+
 '</div></article>').join(""):'<p>Nenhuma solicitação cadastrada nesta unidade.</p>')+'</div>'+
 renderWaitlistModal({services,professionals})+renderBookingModal();
}
/** Modal nativo de inclusão de preferências na lista de espera. */
export function renderWaitlistModal({services=[],professionals=[]}={}){
 return '<dialog class="sp-modal offer-dialog" id="offer-waitlist-dialog" aria-labelledby="offer-waitlist-title"><div class="sp-modal-shell">'+
 '<header class="sp-modal-head"><h2 id="offer-waitlist-title">Adicionar à lista de espera</h2><button type="button" class="sp-modal-close" data-offer-action="close-dialog" aria-label="Fechar">×</button></header>'+
 '<form id="offer-waitlist-form"><div class="sp-modal-body offer-modal-fields">'+
 '<label>Buscar cliente<input id="offer-customer-search" name="customer_search" autocomplete="off" placeholder="Digite ao menos duas letras" required></label>'+
 '<input type="hidden" name="customer_id"><div class="offer-suggestions" id="offer-customer-results"></div>'+
 '<label>Serviço<select name="service_id" required>'+selectOptions(services)+'</select></label>'+
 '<label>Profissional preferido<select name="professional_id">'+selectOptions(professionals,"","Qualquer profissional habilitado")+'</select></label>'+
 '<div class="offer-form-two"><label>De<input type="date" name="from_date" required></label>'+
 '<label>Até<input type="date" name="until_date" required></label></div>'+
 '<div class="offer-form-two"><label>Após<input type="time" name="from_time" value="08:00" required></label>'+
 '<label>Antes de<input type="time" name="until_time" value="20:00" required></label></div>'+
 '<label>Observações (opcional)<textarea name="notes" maxlength="500" rows="3"></textarea></label>'+
 '<p class="client-note">Entrar na lista não reserva horário. O agendamento só é confirmado após consultar uma vaga real.</p></div>'+
 '<footer class="sp-modal-foot"><button type="button" class="btn secondary" data-offer-action="close-dialog">Voltar</button>'+
 '<button class="btn primary" type="submit">Salvar solicitação</button></footer></form></div></dialog>';
}
/** Exige confirmação antes de efetivar uma vaga pelo servidor. */
export function renderBookingModal(){
 return '<dialog class="sp-modal offer-dialog" id="offer-book-dialog" aria-labelledby="offer-book-title"><div class="sp-modal-shell">'+
 '<header class="sp-modal-head"><h2 id="offer-book-title">Confirmar encaixe</h2><button class="sp-modal-close" data-offer-action="close-dialog" type="button" aria-label="Fechar">×</button></header>'+
 '<form id="offer-book-form"><div class="sp-modal-body"><p id="offer-book-summary"></p>'+
 '<p>O sistema consultará a disponibilidade novamente e criará o agendamento. A solicitação sairá da fila na mesma transação.</p></div>'+
 '<footer class="sp-modal-foot"><button class="btn secondary" data-offer-action="close-dialog" type="button">Voltar</button>'+
 '<button class="btn primary" type="submit">Confirmar agendamento</button></footer></form></div></dialog>';
}
/** Relação dos pacotes. O preço é informativo: não se trata de venda automática. */
export function renderPackages({packages=[],services=[],isManager=false}={}){
 const index=new Map(services.map(s=>[s.id,s]));
 return '<div class="offer-toolbar"><p>Combos são definições de serviços; o agendamento agrupado e a cobrança ainda dependem da conversão operacional.</p>'+
 (isManager?'<button class="btn primary" type="button" data-offer-action="new-package">＋ Novo combo</button>':'')+'</div>'+
 '<div class="offer-package-list">'+(packages.length?packages.map(p=>
 '<article class="offer-package"><div class="offer-package-top"><div><strong>'+e(p.name)+'</strong><span>'+
 e(p.branch_id?"Unidade selecionada":"Compartilhado entre unidades")+' · '+e(p.active?"Ativo":"Inativo")+'</span></div>'+
 (isManager&&p.branch_id?'<div><button type="button" class="btn secondary" data-offer-action="edit-package" data-package-id="'+e(p.id)+'">Editar</button>'+
 '<button type="button" class="btn secondary" data-offer-action="toggle-package" data-package-id="'+e(p.id)+'">'+
 (p.active?"Inativar":"Reativar")+'</button></div>':'')+'</div>'+
 (p.description?'<p>'+e(p.description)+'</p>':'')+
 '<ol class="offer-package-steps">'+(p.items||[]).map(item=>'<li>'+e(index.get(item.service_id)?.name||"Serviço cadastrado")+
 ' · '+e(item.quantity)+' vez(es)'+(item.pause_after_minutes?' · pausa '+e(item.pause_after_minutes)+' min':'')+'</li>').join("")+'</ol>'+
 '<small>Preço de referência: '+(p.reference_price==null?"Não definido":e(money(p.reference_price)))+
 ' · Não gera cobrança automaticamente.</small></article>').join(""):'<p>Nenhum pacote cadastrado para esta unidade.</p>')+'</div>'+
 (isManager?renderPackageModal({services}):'');
}
/** Formulário de pacote com etapas adicionáveis e ordem preservada. */
export function renderPackageModal({services=[],name="",description="",referencePrice="",items=[{service_id:"",quantity:1,pause_after_minutes:0}],editing=false}={}){
 return '<dialog class="sp-modal offer-dialog" id="offer-package-dialog" aria-labelledby="offer-package-title"><div class="sp-modal-shell">'+
 '<header class="sp-modal-head"><h2 id="offer-package-title">'+(editing?"Editar combo":"Cadastrar combo")+'</h2>'+
 '<button type="button" data-offer-action="close-dialog" class="sp-modal-close" aria-label="Fechar">×</button></header>'+
 '<form id="offer-package-form"><div class="sp-modal-body offer-modal-fields">'+
 '<label>Nome do combo<input name="name" maxlength="120" required value="'+e(name)+'"></label>'+
 '<label>Descrição<textarea name="description" rows="2" maxlength="1000">'+e(description)+'</textarea></label>'+
 '<label>Preço de referência (R$)<input name="reference_price" type="number" min="0" step="0.01" inputmode="decimal" value="'+e(referencePrice)+'"></label>'+
 '<p class="client-note">Preço apenas informativo. Não aplica cupons, não debita estoque e não abre comandas.</p>'+
 '<h3>Sequência de serviços</h3>'+
 '<div id="offer-package-items">'+items.map((item,i)=>
 '<div class="offer-package-entry"><label>Serviço '+(i+1)+'<select name="service_'+i+'" required>'+selectOptions(services,item.service_id)+'</select></label>'+
 '<div class="offer-form-two"><label>Quantidade<input name="quantity_'+i+'" type="number" min="1" max="20" step="1" value="'+e(item.quantity)+'" required></label>'+
 '<label>Pausa após (min)<input name="pause_'+i+'" type="number" min="0" max="720" step="1" value="'+e(item.pause_after_minutes)+'" required></label></div>'+
 (items.length>1?'<button class="btn secondary" data-offer-action="remove-package-item" data-item-index="'+i+'" type="button">Remover etapa</button>':'')+'</div>').join("")+'</div>'+
 '<button type="button" class="btn secondary" data-offer-action="add-package-item">＋ Adicionar etapa</button>'+
 '</div><footer class="sp-modal-foot"><button class="btn secondary" data-offer-action="close-dialog" type="button">Voltar</button>'+
 '<button class="btn primary" type="submit">Salvar combo</button></footer></form></div></dialog>';
}
function formatTime(value){
 const d=new Date(value);
 return Number.isFinite(d.getTime())?new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(d):"Horário inválido";
}
function formatDate(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value)))return String(value||"");
 const [y,m,d]=value.split("-");
 return d+"/"+m+"/"+y;
}
function formatClock(value){return String(value||"").slice(0,5);}
