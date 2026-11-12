/**
 * Módulo: Serviços.
 * Responsabilidade: consultar o catálogo e cadastrar serviços disponíveis na Agenda e Comandas.
 * Não faz: atribuir profissionais ou registrar atendimentos.
 */
import { supabase } from "../supabase/client.js";
import { state } from "../state.js";
import { head, esc, toast, btn } from "../utils.js";
import { parseBRL } from "../utils/input-masks.js";
import { reportError } from "../utils/errors.js";

let modalListenerInstalled = false;

const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function servicesPage() {
  return head("Serviços", "Cadastre os serviços que aparecem na agenda, nas comandas e no App Profissional.",
    btn("＋ Novo serviço", "open-service-modal", "primary")) +
    '<div id="services-manager"><div class="empty-state">Carregando serviços…</div></div>';
}

/** Consulta os serviços e conecta os eventos do modal uma única vez. */
export async function loadServicesPage() {
  const host = document.querySelector("#services-manager");
  if (!host || !state.organization?.id) return;

  let services;
  try {
    const result = await supabase.from("services")
      .select("id,name,category,duration_minutes,price,active")
      .eq("org_id", state.organization.id).order("name").limit(500);
    if (result.error) throw result.error;
    services = result.data || [];
  } catch (error) {
    reportError(error, { context: "Serviços > carregar lista" });
    host.innerHTML = '<div class="empty-state">Não foi possível carregar os serviços. Atualize a página e tente novamente.</div>';
    return;
  }

  host.innerHTML = `
    <dialog class="sp-modal" id="service-create-modal" aria-labelledby="service-modal-title">
      <div class="sp-modal-shell">
        <header class="sp-modal-head">
          <div><h2 id="service-modal-title">Novo serviço</h2><p>Defina o serviço, a categoria, a duração e o preço.</p></div>
          <button class="sp-modal-close" type="button" data-close-service-modal aria-label="Fechar">×</button>
        </header>
        <form id="service-create-form">
          <div class="sp-modal-body">
            <label class="sp-span">Nome do serviço<input name="name" required maxlength="120" placeholder="Ex.: Corte feminino"></label>
            <label>Categoria<input name="category" placeholder="Cabelo, unhas, estética…"></label>
            <label>Duração (minutos)<input name="duration" type="number" min="5" max="720" step="5" value="30" required></label>
            <label>Preço (R$)<input name="price" type="text" inputmode="decimal" data-mask="currency" value="0,00" required></label>
            <label class="sp-span">Descrição<textarea name="description" rows="3" placeholder="Detalhes opcionais do serviço"></textarea></label>
          </div>
          <footer class="sp-modal-foot">
            <button class="btn secondary" type="button" data-close-service-modal>Cancelar</button>
            <button class="btn primary" type="submit">Cadastrar serviço</button>
          </footer>
        </form>
      </div>
    </dialog>
    <div class="list-toolbar"><span class="result-count">${services.length} serviços</span></div>
    <div class="record-list">${services.map(service => `
      <article class="record-card">
        <span class="record-main"><b>${esc(service.name)}</b><small>${esc(service.category || "Sem categoria")} · ${Number(service.duration_minutes)} min</small></span>
        <span class="record-trailing"><b>${money(service.price)}</b><small>${service.active ? "Ativo" : "Inativo"}</small></span>
      </article>`).join("") || '<div class="empty-state">Nenhum serviço cadastrado.</div>'}
    </div>`;

  if (host.dataset.bound === "true") return;
  host.dataset.bound = "true";

  // O botão do cabeçalho fica fora do host; por isso o clique é delegado ao documento.
  if (!modalListenerInstalled) {
    modalListenerInstalled = true;
    document.addEventListener("click", event => {
    const dialog = document.querySelector("#service-create-modal");
    if (!dialog) return;
    if (event.target.closest('[data-action="open-service-modal"]')) {
      if (!dialog.open) dialog.showModal();
    } else if (event.target.closest("[data-close-service-modal]") || event.target === dialog) {
      if (dialog.open) dialog.close();
    }
    });
  }

  host.addEventListener("submit", async event => {
    if (!event.target.matches("#service-create-form")) return;
    event.preventDefault();

    const form = event.target;
    const values = new FormData(form);
    const submit = form.querySelector('[type="submit"]');
    const name = String(values.get("name") || "").trim();
    const duration = Number(values.get("duration"));
    const price = parseBRL(values.get("price"));

    if (!name || !Number.isFinite(duration) || duration < 5 || duration > 720 ||
        !Number.isFinite(price) || price < 0) {
      toast("Confira o nome, duração e preço.");
      return;
    }

    submit.disabled = true;
    try {
      const { error } = await supabase.from("services").insert({
        org_id: state.organization.id,
        name,
        category: String(values.get("category") || "").trim() || null,
        duration_minutes: duration,
        price,
        description: String(values.get("description") || "").trim() || null,
        active: true
      });
      if (error) throw error;
      host.querySelector("#service-create-modal")?.close();
      toast("Serviço cadastrado.");
      await loadServicesPage();
    } catch (error) {
      reportError(error, { context: "Serviços > salvar cadastro" });
    } finally {
      submit.disabled = false;
    }
  });
}
