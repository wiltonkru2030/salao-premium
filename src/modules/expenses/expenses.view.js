/** Apresentação de despesas, métricas e modais, sem chamadas ao banco. */
import {esc} from "../../utils.js";
const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateLabel = value => value ? new Date(value + (String(value).length === 10 ? "T12:00:00" : "")).toLocaleDateString("pt-BR") : "Sem vencimento";
const labels = { pending: "Pendente", paid: "Paga", cancelled: "Cancelada" };
const methodOptions = [["cash","Dinheiro"],["pix","PIX"],["credit_card","Cartão de crédito"],["debit_card","Cartão de débito"],["transfer","Transferência"],["voucher","Voucher"],["other","Outro"]];


/** Renderiza despesas e ações conforme a permissão informada. */
export function renderExpensesView(rows,canManage){
    const pending = rows.filter(row => row.status === "pending");
    const pendingTotal = pending.reduce((sum, row) => sum + Math.round(Number(row.amount || 0)*100), 0)/100;
    const actions = row => canManage && row.status === "pending"
      ? '<div class="expense-actions"><button class="btn secondary" type="button" data-pay-expense="' + esc(row.id) + '">Registrar pagamento</button><button class="btn secondary" type="button" data-cancel-expense="' + esc(row.id) + '">Cancelar</button></div>' : "";
    const cards = rows.map(row => '<article class="record-card expense-record">' +
      '<span class="record-main"><b>' + esc(row.description) + '</b><small>' + esc(row.category || "Sem categoria") +
      (row.supplier ? " · " + esc(row.supplier) : "") + '</small><small>Vencimento: ' +
      (row.due_date ? new Date(row.due_date + "T12:00:00").toLocaleDateString("pt-BR") : "Sem vencimento") +
      (row.paid_at ? " · Pago em " + new Date(row.paid_at).toLocaleDateString("pt-BR") : "") +
      '</small>' + (row.notes ? '<small>' + esc(row.notes) + '</small>' : "") + '</span>' +
      '<span class="record-trailing"><b>' + money(row.amount) + '</b><small>' + esc(labels[row.status] || row.status) +
      '</small>' + actions(row) + '</span></article>').join("");

    return '<div class="metrics">' +
      '<article class="metric-card"><div class="metric-top"><span>Despesas cadastradas</span></div><strong>' + rows.length + '</strong><small>até 500 registros</small></article>' +
      '<article class="metric-card"><div class="metric-top"><span>Despesas pendentes</span></div><strong>' + pending.length + '</strong><small>aguardando pagamento</small></article>' +
      '<article class="metric-card"><div class="metric-top"><span>Total pendente</span></div><strong>' + money(pendingTotal) + '</strong><small>não é saída efetiva de caixa</small></article></div>' +
      (canManage ? '<dialog class="sp-modal" id="expense-create-modal" aria-labelledby="expense-modal-title"><div class="sp-modal-shell">' +
      '<header class="sp-modal-head"><div><h2 id="expense-modal-title">Nova despesa</h2><p>Cadastre um compromisso financeiro da organização.</p></div>' +
      '<button class="sp-modal-close" type="button" data-close-expense-modal aria-label="Fechar">×</button></header>' +
      '<form id="expense-create-form"><div class="sp-modal-body">' +
      '<label class="sp-span">Descrição<input name="description" required maxlength="200" placeholder="Ex.: Aluguel da unidade"></label>' +
      '<label>Categoria<input name="category" maxlength="80" placeholder="Ex.: Aluguel, material, energia"></label>' +
      '<label>Fornecedor<input name="supplier" maxlength="160" placeholder="Nome do fornecedor"></label>' +
      '<label>Valor (R$)<input name="amount" type="text" inputmode="decimal" data-mask="currency" placeholder="0,00" required></label>' +
      '<label>Vencimento<input name="due_date" type="date"></label>' +
      '<label class="sp-span">Observações<textarea name="notes" rows="3" maxlength="1000"></textarea></label>' +
      '</div><footer class="sp-modal-foot"><button class="btn secondary" type="button" data-close-expense-modal>Cancelar</button><button class="btn primary" type="submit">Cadastrar despesa</button></footer></form></div></dialog>' : "") +

      '<dialog class="sp-modal" id="expense-payment-modal" aria-labelledby="expense-payment-title"><div class="sp-modal-shell">' +
      '<header class="sp-modal-head"><div><h2 id="expense-payment-title">Registrar pagamento</h2><p>Confirme a forma de pagamento e o lançamento no caixa.</p></div>' +
      '<button class="sp-modal-close" type="button" data-close-payment-modal aria-label="Fechar">×</button></header>' +
      '<form id="expense-payment-form"><div class="sp-modal-body"><input type="hidden" name="expense_id">' +
      '<label class="sp-span">Forma de pagamento<select name="payment_method" required>' +
      methodOptions.map(([value, label]) => '<option value="' + value + '">' + label + '</option>').join("") +
      '</select></label><label class="sp-span"><span><input type="checkbox" name="use_cash" checked> Registrar a saída também no Caixa</span></label>' +
      '<p class="demo-note sp-span">Desmarque somente se o pagamento ocorreu fora do caixa do sistema.</p></div>' +
      '<footer class="sp-modal-foot"><button class="btn secondary" type="button" data-close-payment-modal>Voltar</button><button class="btn primary" type="submit">Confirmar pagamento</button></footer></form></div></dialog>' +
      '<div class="list-toolbar"><span class="result-count">' + rows.length + ' despesa(s)</span></div>' +
      '<div class="record-list">' + (cards || '<div class="empty-state">Nenhuma despesa cadastrada.</div>') + '</div>' +
      '<p class="demo-note">O pagamento usa uma operação transacional do banco. Ao lançar no caixa, a saída é registrada automaticamente uma única vez.</p>';


}
