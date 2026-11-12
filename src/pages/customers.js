/**
 * Módulo: Clientes.
 * Responsabilidade: consultar a base da organização e criar clientes pelo modal global.
 * Não faz: gerenciar profissionais, comandas ou autenticação.
 */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, toast, btn } from "../utils.js";
import { reportError } from "../utils/errors.js";

let modalListenerInstalled = false;

export function customersPage() {
  return head("Clientes", "Cadastre e mantenha os dados dos clientes em um único lugar.",
    btn("＋ Novo cliente", "open-customer-modal", "primary")) +
    '<div id="customers-manager"><div class="empty-state">Carregando clientes…</div></div>';
}

/** Consulta os clientes e conecta os eventos do modal uma única vez. */
export async function loadCustomersPage() {
  const host = document.querySelector("#customers-manager");
  if (!host || !state.organization?.id) return;

  let customers;
  try {
    const result = await supabase.from("customers")
      .select("id,name,phone,email,birth_date,active")
      .eq("org_id", state.organization.id)
      .order("name").limit(500);
    if (result.error) throw result.error;
    customers = result.data || [];
  } catch (error) {
    reportError(error, { context: "Clientes > carregar lista" });
    host.innerHTML = '<div class="empty-state">Não foi possível carregar os clientes. Atualize a página e tente novamente.</div>';
    return;
  }

  host.innerHTML = `
    <dialog class="sp-modal" id="customer-create-modal" aria-labelledby="customer-modal-title">
      <div class="sp-modal-shell">
        <header class="sp-modal-head">
          <div><h2 id="customer-modal-title">Novo cliente</h2><p>Informe os dados para adicionar à base de clientes.</p></div>
          <button class="sp-modal-close" type="button" data-close-customer-modal aria-label="Fechar">×</button>
        </header>
        <form id="customer-create-form">
          <div class="sp-modal-body">
            <label class="sp-span">Nome completo<input name="name" required maxlength="120" placeholder="Nome do cliente" autocomplete="name"></label>
            <label>Telefone<input name="phone" type="tel" data-mask="phone" placeholder="(00) 00000-0000" autocomplete="tel"></label>
            <label>E-mail<input name="email" type="email" placeholder="cliente@email.com" autocomplete="email"></label>
            <label>Data de nascimento<input name="birth_date" type="date"></label>
          </div>
          <footer class="sp-modal-foot">
            <button class="btn secondary" type="button" data-close-customer-modal>Cancelar</button>
            <button class="btn primary" type="submit">Cadastrar cliente</button>
          </footer>
        </form>
      </div>
    </dialog>
    <div class="list-toolbar"><span class="result-count">${customers.length} clientes</span></div>
    <div class="record-list">${customers.map(customer => `
      <article class="record-card">
        <span class="record-main"><b>${esc(customer.name)}</b><small>${esc(customer.phone || "Telefone não informado")}</small><small>${esc(customer.email || "")}</small></span>
        <span class="record-trailing"><small>${customer.active ? "Ativo" : "Inativo"}</small></span>
      </article>`).join("") || '<div class="empty-state">Nenhum cliente cadastrado.</div>'}
    </div>`;

  if (host.dataset.bound === "true") return;
  host.dataset.bound = "true";

  // O botão do cabeçalho fica fora do host; por isso o clique é delegado ao documento.
  if (!modalListenerInstalled) {
    modalListenerInstalled = true;
    document.addEventListener("click", event => {
    const dialog = document.querySelector("#customer-create-modal");
    if (!dialog) return;
    if (event.target.closest('[data-action="open-customer-modal"]')) {
      if (!dialog.open) dialog.showModal();
    } else if (event.target.closest("[data-close-customer-modal]") || event.target === dialog) {
      if (dialog.open) dialog.close();
    }
    });
  }

  host.addEventListener("submit", async event => {
    if (!event.target.matches("#customer-create-form")) return;
    event.preventDefault();

    const form = event.target;
    const submit = form.querySelector('[type="submit"]');
    const values = new FormData(form);
    const name = String(values.get("name") || "").trim();
    if (!name) { toast("Informe o nome do cliente."); return; }

    submit.disabled = true;
    try {
      const { error } = await supabase.from("customers").insert({
        org_id: state.organization.id,
        name,
        phone: String(values.get("phone") || "").trim() || null,
        email: String(values.get("email") || "").trim() || null,
        birth_date: String(values.get("birth_date") || "") || null
      });
      if (error) throw error;
      host.querySelector("#customer-create-modal")?.close();
      toast("Cliente cadastrado.");
      await loadCustomersPage();
    } catch (error) {
      reportError(error, { context: "Clientes > salvar cadastro" });
    } finally {
      submit.disabled = false;
    }
  });
}
