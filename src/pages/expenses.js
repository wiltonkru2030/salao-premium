/**
 * Módulo de Despesas — SALÃO PREMIUM.
 * Cadastro de compromissos e baixa/cancelamento por RPC transacional.
 * O pagamento no caixa é registrado exclusivamente pela função pay_expense.
 */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, toast, btn } from "../utils.js";
import { parseBRL } from "../utils/input-masks.js";
import { reportError } from "../utils/errors.js";

let modalListenerInstalled = false;
const canManage = () => ["owner", "admin", "manager", "finance"].includes(state.membership?.role);
const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateLabel = value => value ? new Date(value + (String(value).length === 10 ? "T12:00:00" : "")).toLocaleDateString("pt-BR") : "Sem vencimento";
const labels = { pending: "Pendente", paid: "Paga", cancelled: "Cancelada" };
const methodOptions = [["cash","Dinheiro"],["pix","PIX"],["credit_card","Cartão de crédito"],["debit_card","Cartão de débito"],["transfer","Transferência"],["voucher","Voucher"],["other","Outro"]];

export function expensesPage() {
  return head("Despesas", "Cadastre compromissos, registre pagamentos e acompanhe vencimentos.",
    canManage() ? btn("＋ Nova despesa", "open-expense-modal", "primary") : "") +
    '<div id="expenses-manager"><div class="empty-state">Carregando despesas…</div></div>';
}

/** Consulta despesas do tenant ativo e conecta as operações permitidas ao perfil financeiro. */
export async function loadExpensesPage() {
  const host = document.querySelector("#expenses-manager");
  const orgId = state.organization?.id;
  if (!host || !orgId) return;
  try {
    const { data, error } = await supabase.from("expenses")
      .select("id,description,category,amount,due_date,paid_at,status,supplier,notes")
      .eq("org_id", orgId).order("due_date", { ascending: true, nullsFirst: false }).limit(500);
    if (error) throw error;
    const rows = data || [];
    const pending = rows.filter(row => row.status === "pending");
    const pendingTotal = pending.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const actions = row => canManage() && row.status === "pending"
      ? '<div class="expense-actions"><button class="btn secondary" type="button" data-pay-expense="' + esc(row.id) + '">Registrar pagamento</button><button class="btn secondary" type="button" data-cancel-expense="' + esc(row.id) + '">Cancelar</button></div>' : "";
    const cards = rows.map(row => '<article class="record-card expense-record">' +
      '<span class="record-main"><b>' + esc(row.description) + '</b><small>' + esc(row.category || "Sem categoria") +
      (row.supplier ? " · " + esc(row.supplier) : "") + '</small><small>Vencimento: ' +
      (row.due_date ? new Date(row.due_date + "T12:00:00").toLocaleDateString("pt-BR") : "Sem vencimento") +
      (row.paid_at ? " · Pago em " + new Date(row.paid_at).toLocaleDateString("pt-BR") : "") +
      '</small>' + (row.notes ? '<small>' + esc(row.notes) + '</small>' : "") + '</span>' +
      '<span class="record-trailing"><b>' + money(row.amount) + '</b><small>' + esc(labels[row.status] || row.status) +
      '</small>' + actions(row) + '</span></article>').join("");

    host.innerHTML = '<div class="metrics">' +
      '<article class="metric-card"><div class="metric-top"><span>Despesas cadastradas</span></div><strong>' + rows.length + '</strong><small>até 500 registros</small></article>' +
      '<article class="metric-card"><div class="metric-top"><span>Despesas pendentes</span></div><strong>' + pending.length + '</strong><small>aguardando pagamento</small></article>' +
      '<article class="metric-card"><div class="metric-top"><span>Total pendente</span></div><strong>' + money(pendingTotal) + '</strong><small>não é saída efetiva de caixa</small></article></div>' +
      (canManage() ? '<dialog class="sp-modal" id="expense-create-modal" aria-labelledby="expense-modal-title"><div class="sp-modal-shell">' +
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

    if (host.dataset.bound === "true") return;
    host.dataset.bound = "true";
    if (!modalListenerInstalled) {
      modalListenerInstalled = true;
      document.addEventListener("click", event => {
        const createDialog = document.querySelector("#expense-create-modal");
        const paymentDialog = document.querySelector("#expense-payment-modal");
        if (event.target.closest('[data-action="open-expense-modal"]') && canManage() && createDialog) {
          if (!createDialog.open) createDialog.showModal();
        } else if (event.target.closest("[data-close-expense-modal]") && createDialog) {
          if (createDialog.open) createDialog.close();
        } else if (event.target.closest("[data-close-payment-modal]") && paymentDialog) {
          if (paymentDialog.open) paymentDialog.close();
        } else if (event.target === createDialog && createDialog?.open) {
          createDialog.close();
        } else if (event.target === paymentDialog && paymentDialog?.open) {
          paymentDialog.close();
        }
      });
    }
    host.addEventListener("submit", async event => {
      if (!event.target.matches("#expense-create-form")) return;
      event.preventDefault();
      if (!canManage()) { toast("Seu perfil não pode cadastrar despesas."); return; }
      const form = event.target, values = new FormData(form);
      const description = String(values.get("description") || "").trim();
      const amount = parseBRL(values.get("amount"));
      if (!description || !Number.isFinite(amount) || amount <= 0) { toast("Informe a descrição e um valor maior que zero."); return; }
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        const { error: insertError } = await supabase.from("expenses").insert({
          org_id: orgId, branch_id: state.branch?.id || null, description,
          category: String(values.get("category") || "").trim() || null,
          supplier: String(values.get("supplier") || "").trim() || null,
          amount, due_date: String(values.get("due_date") || "") || null,
          notes: String(values.get("notes") || "").trim() || null, status: "pending",
          created_by: state.user?.id || null
        });
        if (insertError) throw insertError;
        host.querySelector("#expense-create-modal")?.close();
        toast("Despesa cadastrada.");
        await loadExpensesPage();
      } catch (err) { reportError(err, { context: "Despesas > cadastrar" }); }
      finally { if (submit.isConnected) submit.disabled = false; }
    });
    host.addEventListener("submit", async event => {
      if (!event.target.matches("#expense-payment-form")) return;
      event.preventDefault();
      if (!canManage()) { toast("Seu perfil não pode pagar despesas."); return; }
      const form = event.target, values = new FormData(form);
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        const { error } = await supabase.rpc("pay_expense", {
          p_expense_id: String(values.get("expense_id") || ""),
          p_payment_method: String(values.get("payment_method") || ""),
          p_use_cash: values.get("use_cash") === "on"
        });
        if (error) throw error;
        host.querySelector("#expense-payment-modal")?.close();
        toast("Pagamento registrado.");
        await loadExpensesPage();
      } catch (err) { reportError(err, { context: "Despesas > pagar" }); }
      finally { if (button.isConnected) button.disabled = false; }
    });
    host.addEventListener("click", async event => {
      const pay = event.target.closest("[data-pay-expense]");
      const cancel = event.target.closest("[data-cancel-expense]");
      if (!pay && !cancel) return;
      if (!canManage()) { toast("Seu perfil não pode operar despesas."); return; }
      if (pay) {
        const dialog = host.querySelector("#expense-payment-modal");
        const form = host.querySelector("#expense-payment-form");
        if (!dialog || !form) { toast("Não foi possível abrir o pagamento."); return; }
        form.elements.expense_id.value = pay.dataset.payExpense;
        dialog.showModal();
        return;
      }
      if (!window.confirm("Deseja cancelar esta despesa pendente?")) return;
      cancel.disabled = true;
      try {
        const { error } = await supabase.rpc("cancel_expense", { p_expense_id: cancel.dataset.cancelExpense });
        if (error) throw error;
        toast("Despesa cancelada.");
        await loadExpensesPage();
      } catch (err) { reportError(err, { context: "Despesas > cancelar" }); }
      finally { if (cancel.isConnected) cancel.disabled = false; }
    });
  } catch (err) {
    reportError(err, { context: "Despesas > carregar lista" });
    host.innerHTML = '<div class="empty-state"><b>Não foi possível carregar as despesas.</b><small>Verifique sua conexão e suas permissões e tente novamente.</small></div>';
  }
}
