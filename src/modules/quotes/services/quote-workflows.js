/**
 * Fluxos de documento e agendamento do módulo Orçamentos.
 * Dependências são recebidas por parâmetro; esta camada não depende do estado da página.
 */

/**
 * Gera a versão imprimível do orçamento e prepara o link público de aceite/recusa.
 * O token público é aleatório; somente seu hash SHA-256 é persistido.
 */
export async function printQuoteDocument({ quote, orgId, supabase, state, esc, money, statusName, toast }) {
  if (!quote) return;

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    toast("Permita a abertura da janela para imprimir o orçamento.");
    return;
  }
  printWindow.opener = null;

  const [orgResult, branchResult, professionalResult] = await Promise.all([
    supabase.from("organizations").select("name,document,phone").eq("id", orgId).single(),
    supabase.from("branches").select("name,document,address,phone,is_main").eq("org_id", orgId).eq("is_main", true).maybeSingle(),
    supabase.from("professionals").select("id,name").eq("org_id", orgId)
  ]);
  if (orgResult.error) throw orgResult.error;
  if (branchResult.error) throw branchResult.error;
  if (professionalResult.error) throw professionalResult.error;

  const organization = orgResult.data;
  const branch = branchResult.data;
  const professionals = new Map((professionalResult.data || []).map(item => [item.id, item.name]));
  const address = branch?.address || {};
  const addressText = typeof address === "string"
    ? address
    : [address.street, address.number, address.district, address.city, address.state, address.zip].filter(Boolean).join(", ");
  const documentNumber = branch?.document || organization.document || "Documento não cadastrado";

  let responseUrl = null;
  if (quote.status === "pending") {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    const tokenHash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
    const { data: updatedQuote, error } = await supabase
      .from("quotes")
      .update({ public_token_hash: tokenHash })
      .eq("org_id", orgId)
      .eq("id", quote.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!updatedQuote) throw new Error("O orçamento não está mais pendente para resposta.");
    responseUrl = "https://vlifbvzlyzoncefvfgol.supabase.co/functions/v1/respond-to-quote?token=" + token;
  }

  const itemRows = quote.items.map(item => `
    <div class="row">
      <span>
        <b>${esc(item.description)}</b><br>
        <small>${Number(item.quantity)} × ${money(item.unit_price)} · ${esc(professionals.get(item.professional_id) || "Profissional a definir")}</small>
      </span>
      <b>${money(item.total)}</b>
    </div>`).join("");

  const responseSection = responseUrl
    ? `<p>Para aceitar ou recusar esta proposta, acesse: <a href="${esc(responseUrl)}">Responder ao orçamento</a></p>`
    : "";

  printWindow.document.write(`
    <!doctype html>
    <html lang="pt-BR">
      <meta charset="utf-8">
      <title>Orçamento #${esc(quote.quote_number)}</title>
      <style>
        body{font:15px Arial,sans-serif;color:#202020;max-width:800px;margin:40px auto;padding:24px}
        header{border-bottom:2px solid #b69a62;padding-bottom:18px;margin-bottom:24px}
        h1{font-size:28px}small{color:#666}
        .row{display:flex;justify-content:space-between;padding:13px 0;border-bottom:1px solid #eee}
        .total{font-size:24px;font-weight:bold;color:#8b7041;margin-top:20px;text-align:right}
        .foot{margin-top:40px;color:#666;font-size:12px}
        @media print{button{display:none}}
      </style>
      <header>
        <h1>${esc(branch?.name || organization.name)}</h1>
        <p>${esc(addressText || "Endereço não cadastrado")}</p>
        <p>CPF/CNPJ: ${esc(documentNumber)} · ${esc(branch?.phone || organization.phone || "")}</p>
      </header>
      <h2>Orçamento #${esc(quote.quote_number)}</h2>
      <p>Cliente: ${esc(quote.customer?.name || "")} · WhatsApp: ${esc(quote.customer?.phone || "")}</p>
      ${itemRows}
      <div class="row"><span>Subtotal</span><b>${money(quote.subtotal)}</b></div>
      <div class="row"><span>Descontos</span><b>− ${money(quote.discount_total)}</b></div>
      <div class="total">Valor final: ${money(quote.total)}</div>
      ${responseSection}
      <p>Proposta: ${esc(statusName(quote.status))}${quote.valid_until ? " · Válida até " + new Date(quote.valid_until + "T12:00:00").toLocaleDateString("pt-BR") : ""}</p>
      <footer class="foot">Orçamento gerado pelo SALÃO PREMIUM. Esta proposta não representa pagamento ou agendamento confirmado.</footer>
      <script>window.onload=()=>window.print()<\/script>
    </html>
  `);
  printWindow.document.close();
}

/**
 * Agenda os serviços do orçamento aceito em uma única RPC transacional.
 * O front-end valida conflitos dentro do próprio grupo; o banco valida tenant,
 * habilitação profissional, bloqueios e conflitos com a Agenda existente.
 */
export async function openQuoteSchedule({ quote, orgId, supabase, host, esc, toast, reportError, loadQuotesPage, openQuote }) {
  const [itemsResult, professionalResult, assignmentResult] = await Promise.all([
    supabase.from("quote_items").select("id,service_id,professional_id,description,quantity,duration_minutes,total").eq("org_id", orgId).eq("quote_id", quote.id).order("sort_order"),
    supabase.from("professionals").select("id,name").eq("org_id", orgId).eq("active", true).order("name"),
    supabase.from("professional_services").select("professional_id,service_id").eq("org_id", orgId)
  ]);
  if (itemsResult.error) throw itemsResult.error;
  if (professionalResult.error) throw professionalResult.error;
  if (assignmentResult.error) throw assignmentResult.error;

  const items = itemsResult.data || [];
  const professionals = professionalResult.data || [];
  const assignments = assignmentResult.data || [];

  const itemForms = items.map((item, index) => {
    const eligibleProfessionals = professionals.filter(professional =>
      assignments.some(link => link.service_id === item.service_id && link.professional_id === professional.id)
    );
    const professionalOptions = eligibleProfessionals.map(professional => `
      <option value="${esc(professional.id)}" ${professional.id === item.professional_id ? "selected" : ""}>${esc(professional.name)}</option>
    `).join("");

    return `
      <div class="quote-schedule-item">
        <h3>${esc(item.description)}</h3>
        <div class="form-grid">
          <label>Profissional
            <select class="field" name="professional_${index}" required>
              <option value="">Selecione</option>${professionalOptions}
            </select>
          </label>
          <label>Data<input class="field" type="date" name="date_${index}" required></label>
          <label>Horário<input class="field" type="time" name="time_${index}" required></label>
        </div>
        <input type="hidden" name="item_${index}" value="${esc(item.id)}">
        <input type="hidden" name="service_${index}" value="${esc(item.service_id)}">
        <input type="hidden" name="duration_${index}" value="${Number(item.duration_minutes)}">
        <input type="hidden" name="price_${index}" value="${Number(item.total)}">
      </div>`;
  }).join("");

  host.innerHTML = `
    <section class="settings-card">
      <div class="section-title">
        <div><h2>Agendar orçamento #${esc(quote.quote_number)}</h2><small class="muted">Defina um horário independente para cada serviço.</small></div>
      </div>
      <form id="quote-schedule-form">
        ${itemForms}
        <button class="btn primary" type="submit">Confirmar todos os horários</button>
        <button class="btn secondary" type="button" id="quote-schedule-back">Voltar</button>
      </form>
    </section>`;

  host.querySelector("#quote-schedule-back").addEventListener("click", () => openQuote(quote.id, orgId));
  host.querySelector("#quote-schedule-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    const values = new FormData(form);
    button.disabled = true;
    button.textContent = "Verificando disponibilidade…";

    try {
      const prepared = items.map((item, index) => {
        const professionalId = String(values.get("professional_" + index) || "");
        const date = String(values.get("date_" + index) || "");
        const time = String(values.get("time_" + index) || "");
        const duration = Number(item.duration_minutes) * Number(item.quantity || 1);
        const start = new Date(date + "T" + time + ":00");
        const end = new Date(start.getTime() + duration * 60000);
        if (!professionalId || !date || !time || Number.isNaN(start.getTime())) {
          throw new Error("Preencha profissional, data e horário de todos os serviços.");
        }
        return { item, professionalId, start, end };
      });

      for (let i = 0; i < prepared.length; i++) {
        for (let j = i + 1; j < prepared.length; j++) {
          const first = prepared[i];
          const second = prepared[j];
          if (first.professionalId === second.professionalId && first.start < second.end && second.start < first.end) {
            throw new Error("Dois serviços do mesmo profissional estão no mesmo horário. Ajuste os horários.");
          }
        }
      }

      const payload = prepared.map(entry => ({
        quote_item_id: entry.item.id,
        professional_id: entry.professionalId,
        starts_at: entry.start.toISOString(),
        ends_at: entry.end.toISOString()
      }));
      const { data: group, error } = await supabase.rpc("create_quote_appointment_group", {
        p_quote_id: quote.id,
        p_items: payload
      });
      if (error) throw error;

      toast("Agendamento agrupado criado com " + Number(group?.count || prepared.length) + " serviço(s).");
      await loadQuotesPage();
    } catch (error) {
      reportError(error, { context: "Orçamentos > agendar horários" });
      button.disabled = false;
      button.textContent = "Confirmar todos os horários";
    }
  });
}
