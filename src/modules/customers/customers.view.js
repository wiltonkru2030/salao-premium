/**
 * Estrutura visual da carteira de clientes do painel SALÃO PREMIUM.
 * Responsabilidade: gerar a marcação da listagem e do modal, sem eventos ou API.
 * Integração: o controlador de clientes fornece os registros e a permissão visual.
 */
import { esc } from "../../utils.js";

/**
 * Renderiza a listagem e o formulário de clientes.
 * Escapa dados externos antes de inseri-los na marcação.
 * @param {Array<object>} customers Registros da unidade ativa.
 * @param {boolean} canManage Permissão para exibir ações de gerenciamento.
 * @returns {string} Marcação da carteira de clientes.
 */
export function renderCustomersView(customers,canManage=false) {
  if(!Array.isArray(customers))throw new TypeError("A lista de clientes não é válida.");
  const cards=customers.map(customer=>{
    const actions=canManage
      ? '<button class="btn secondary" type="button" data-edit-customer="'+esc(customer.id)+'">Editar</button>'+
        '<button class="text-button" type="button" data-toggle-customer="'+esc(customer.id)+'" data-active="'+(customer.active?"true":"false")+'">'+(customer.active?"Inativar":"Reativar")+'</button>'
      : "";
    return '<article class="record-card"><span class="record-main"><b>'+esc(customer.name)+'</b>'+
      '<small>'+esc(customer.phone||"Telefone não informado")+'</small>'+
      '<small>'+esc(customer.email||"")+'</small></span>'+
      '<span class="record-trailing"><small class="status-pill '+(customer.active?"active":"inactive")+'">'+(customer.active?"Ativo":"Inativo")+'</small>'+actions+'</span></article>';
  }).join("");

  return '<dialog class="sp-modal" id="customer-create-modal" aria-labelledby="customer-modal-title">'+
      '<div class="sp-modal-shell"><header class="sp-modal-head"><div><h2 id="customer-modal-title">Novo cliente</h2><p>Informe os dados para adicionar à base de clientes.</p></div>'+
      '<button class="sp-modal-close" type="button" data-close-customer-modal aria-label="Fechar">×</button></header>'+
      '<form id="customer-create-form"><input type="hidden" name="customer_id"><div class="sp-modal-body">'+
      '<label class="sp-span">Nome completo<input name="name" required minlength="2" maxlength="120" placeholder="Nome do cliente" autocomplete="name"></label>'+
      '<label>Telefone<input name="phone" type="tel" data-mask="phone" placeholder="(00) 00000-0000" autocomplete="tel"></label>'+
      '<label>E-mail<input name="email" type="email" maxlength="254" placeholder="cliente@email.com" autocomplete="email"></label>'+
      '<label>Data de nascimento<input name="birth_date" type="date"></label>'+
      '</div><footer class="sp-modal-foot"><button class="btn secondary" type="button" data-close-customer-modal>Cancelar</button>'+
      '<button class="btn primary" type="submit">Cadastrar cliente</button></footer></form></div></dialog>'+
    '<div class="list-toolbar"><span class="result-count">'+customers.length+' clientes</span></div>'+
    '<div class="record-list">'+(cards||'<div class="empty-state">Nenhum cliente cadastrado.</div>')+'</div>';

}

/**
 * Renderiza o estado transitório da carteira sem expor dados da unidade anterior.
 * @param {boolean} failed Indica falha na consulta.
 * @returns {string} Mensagem acessível e ação de nova tentativa, quando aplicável.
 */
export function renderCustomersStatus(failed=false) {
  return failed
    ? '<div class="empty-state" role="alert">Não foi possível carregar os clientes. <button type="button" class="btn secondary" data-retry-customers>Tentar novamente</button></div>'
    : '<div class="empty-state" role="status" aria-live="polite">Carregando clientes…</div>';
}
