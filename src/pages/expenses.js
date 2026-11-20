/**
 * Módulo de Despesas — SALÃO PREMIUM.
 * Cadastro de compromissos e baixa/cancelamento por RPC transacional.
 * O pagamento no caixa é registrado exclusivamente pela função pay_expense.
 */
import { renderExpensesView } from "../modules/expenses/expenses.view.js";
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, toast, btn } from "../utils.js";
import { parseBRL } from "../utils/input-masks.js";
import { reportError } from "../utils/errors.js";
import { listExpenses, createExpense, payExpense, cancelExpense } from "../modules/expenses/expenses.service.js";

let modalListenerInstalled = false;
const canManage = () => ["owner", "admin", "manager", "finance"].includes(state.membership?.role);
/**
 * Renderiza a página de despesas e o estado inicial de carregamento.
 * @returns {string} HTML da página com ações condicionadas ao perfil financeiro.
 */
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
  const context=JSON.stringify([orgId,state.user?.id,state.branch?.id||null]);
  const request=String(Number(host.dataset.request||0)+1);host.dataset.request=request;
  host.dataset.context="";
  const current=()=>host.isConnected&&host.dataset.request===request&&context===JSON.stringify([state.organization?.id,state.user?.id,state.branch?.id||null]);
  host.textContent="Carregando despesas…";
  try {
    const rows = await listExpenses({client:supabase,orgId:state.organization.id,branchId:state.branch?.id||null,limit:500});
    if(!current())return;
    host.innerHTML=renderExpensesView(rows,canManage());
    host.dataset.context=context;
    if (host.dataset.bound === "true") return;
    const active=()=>host.isConnected&&host.dataset.context===JSON.stringify([state.organization?.id,state.user?.id,state.branch?.id||null]);
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
      if (!active()) return;
      if (!canManage()) { toast("Seu perfil não pode cadastrar despesas."); return; }
      const form = event.target, values = new FormData(form);
      const description = String(values.get("description") || "").trim();
      const amount = parseBRL(values.get("amount"));
      if (!description || !Number.isFinite(amount) || amount <= 0) { toast("Informe a descrição e um valor maior que zero."); return; }
      const submit = form.querySelector('[type="submit"]');
      if(!submit||submit.disabled)return;
      submit.disabled = true;
      try {
        await createExpense({
          client:supabase,orgId:state.organization.id,branchId:state.branch?.id||null,createdBy:state.user?.id||null,
          description,category:values.get("category"),supplier:values.get("supplier"),
          amount,dueDate:values.get("due_date"),notes:values.get("notes")
        });
        host.querySelector("#expense-create-modal")?.close();
        toast("Despesa cadastrada.");
        await loadExpensesPage();
      } catch (err) { reportError(err, { context: "Despesas > cadastrar" }); }
      finally { if (submit.isConnected) submit.disabled = false; }
    });
    host.addEventListener("submit", async event => {
      if (!event.target.matches("#expense-payment-form")) return;
      event.preventDefault();
      if (!active()) return;
      if (!canManage()) { toast("Seu perfil não pode pagar despesas."); return; }
      const form = event.target, values = new FormData(form);
      const button = form.querySelector('[type="submit"]');
      if(!button||button.disabled)return;
      button.disabled = true;
      try {
        await payExpense({
          client:supabase,orgId:state.organization.id,expenseId:String(values.get("expense_id")||""),
          paymentMethod:String(values.get("payment_method")||""),useCash:values.get("use_cash")==="on"
        });
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
      if (!active()) return;
      if (!canManage()) { toast("Seu perfil não pode operar despesas."); return; }
      if (pay) {
        const dialog = host.querySelector("#expense-payment-modal");
        const form = host.querySelector("#expense-payment-form");
        if (!dialog || !form) { toast("Não foi possível abrir o pagamento."); return; }
        form.elements.expense_id.value = pay.dataset.payExpense;
        dialog.showModal();
        return;
      }
      if(cancel.disabled)return;
      if (!window.confirm("Deseja cancelar esta despesa pendente?")) return;
      cancel.disabled = true;
      try {
        await cancelExpense({client:supabase,orgId:state.organization.id,expenseId:cancel.dataset.cancelExpense});
        toast("Despesa cancelada.");
        await loadExpensesPage();
      } catch (err) { reportError(err, { context: "Despesas > cancelar" }); }
      finally { if (cancel.isConnected) cancel.disabled = false; }
    });
  } catch (err) {
    if(!current())return;
    reportError(err, { context: "Despesas > carregar lista" });
    host.innerHTML = '<div class="empty-state"><b>Não foi possível carregar as despesas.</b><small>Verifique sua conexão e suas permissões e tente novamente.</small></div>';
  }
}
