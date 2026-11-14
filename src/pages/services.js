/**
 * Módulo: Serviços.
 * Responsabilidade: consultar e manter o catálogo utilizado pela Agenda e Comandas.
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

export async function loadServicesPage() {
  const host = document.querySelector("#services-manager");
  if (!host || !state.organization?.id) return;
  let services;
  try {
    const result = await supabase.from("services")
      .select("id,name,category,duration_minutes,price,description,active")
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
            <label>Categoria<input name="category" maxlength="80" placeholder="Cabelo, unhas, estética…"></label>
            <label>Duração (minutos)<input name="duration" type="number" min="5" max="720" step="5" value="30" required></label>
            <label>Preço (R$)<input name="price" type="text" inputmode="decimal" data-mask="currency" value="0,00" required></label>
            <label class="sp-span">Descrição<textarea name="description" rows="3" maxlength="1000" placeholder="Detalhes opcionais do serviço"></textarea></label>
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
        <span class="record-trailing"><b>${money(service.price)}</b><small>${service.active ? "Ativo" : "Inativo"}</small>
          <span class="record-actions"><button class="btn secondary" type="button" data-edit-service="${service.id}">Editar</button><button class="btn secondary" type="button" data-toggle-service="${service.id}" data-active="${service.active ? "true" : "false"}">${service.active ? "Desativar" : "Ativar"}</button></span>
        </span>
      </article>`).join("") || '<div class="empty-state">Nenhum serviço cadastrado.</div>'}
    </div>`;

  if (host.dataset.bound === "true") return;
  host.dataset.bound = "true";
  if (!modalListenerInstalled) {
    modalListenerInstalled = true;
    document.addEventListener("click", event => {
      const dialog = document.querySelector("#service-create-modal");
      if (!dialog) return;
      if (event.target.closest('[data-action="open-service-modal"]')) {
        const form = dialog.querySelector("#service-create-form");
        form.reset(); form.dataset.serviceId = "";
        dialog.querySelector("#service-modal-title").textContent = "Novo serviço";
        form.querySelector('[type="submit"]').textContent = "Cadastrar serviço";
        if (!dialog.open) dialog.showModal();
      } else if (event.target.closest("[data-close-service-modal]") || event.target === dialog) {
        if (dialog.open) dialog.close();
      }
    });
  }

  host.addEventListener("click", async event => {
    const edit = event.target.closest("[data-edit-service]");
    if (edit) {
      const service = services.find(item => item.id === edit.dataset.editService);
      const dialog = host.querySelector("#service-create-modal");
      if (!service || !dialog) return;
      const form = dialog.querySelector("#service-create-form");
      form.dataset.serviceId = service.id;
      form.elements.name.value = service.name || "";
      form.elements.category.value = service.category || "";
      form.elements.duration.value = service.duration_minutes || 30;
      form.elements.price.value = Number(service.price || 0).toFixed(2).replace(".", ",");
      form.elements.description.value = service.description || "";
      dialog.querySelector("#service-modal-title").textContent = "Editar serviço";
      form.querySelector('[type="submit"]').textContent = "Salvar alterações";
      dialog.showModal();
      return;
    }
    const toggle = event.target.closest("[data-toggle-service]");
    if (toggle) {
      const active = toggle.dataset.active === "true";
      if (!window.confirm(active ? "Desativar este serviço? Ele deixará de aparecer para novos agendamentos e comandas." : "Reativar este serviço?")) return;
      toggle.disabled = true;
      try {
        const { error } = await supabase.from("services").update({ active: !active })
          .eq("org_id", state.organization.id).eq("id", toggle.dataset.toggleService);
        if (error) throw error;
        toast(active ? "Serviço desativado." : "Serviço reativado.");
        await loadServicesPage();
      } catch (error) {
        reportError(error, { context: "Serviços > alterar situação" });
        toggle.disabled = false;
      }
    }
  });

  host.addEventListener("submit", async event => {
    if (!event.target.matches("#service-create-form")) return;
    event.preventDefault();
    const form = event.target, values = new FormData(form), submit = form.querySelector('[type="submit"]');
    const name = String(values.get("name") || "").trim();
    const duration = Number(values.get("duration")), price = parseBRL(values.get("price"));
    if (!name || !Number.isFinite(duration) || duration < 5 || duration > 720 ||
        !Number.isFinite(price) || price < 0) {
      toast("Confira o nome, duração e preço."); return;
    }
    submit.disabled = true;
    try {
      const payload = {
        name, category: String(values.get("category") || "").trim() || null,
        duration_minutes: duration, price,
        description: String(values.get("description") || "").trim() || null
      };
      const serviceId = form.dataset.serviceId;
      const result = serviceId
        ? await supabase.from("services").update(payload).eq("org_id", state.organization.id).eq("id", serviceId)
        : await supabase.from("services").insert({ ...payload, org_id: state.organization.id, active: true });
      if (result.error) throw result.error;
      host.querySelector("#service-create-modal")?.close();
      toast(serviceId ? "Serviço atualizado." : "Serviço cadastrado.");
      await loadServicesPage();
    } catch (error) {
      reportError(error, { context: "Serviços > salvar cadastro" });
    } finally { submit.disabled = false; }
  });
}
