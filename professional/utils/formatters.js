/**
 * SALÃO PREMIUM — formatadores do App Profissional.
 * Responsabilidade: concentrar conversões puras de valores, datas, horários e
 * rótulos usados nas telas do PWA. Não acessa DOM, rede, sessão ou banco de dados.
 * Integração: importado pelo compositor professional/app.js e testado isoladamente.
 */

/**
 * Escapa caracteres especiais antes de inserir valores dinâmicos em templates HTML.
 * @param {unknown} value Valor que será apresentado.
 * @returns {string} Texto seguro para interpolação em HTML.
 */
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

/**
 * Formata um valor monetário em reais, usando convenções brasileiras.
 * @param {number|string|null|undefined} value Valor numérico recebido da aplicação.
 * @returns {string} Valor formatado em BRL.
 */
export function formatMoney(value) {
  // Ausência de valor não significa zero: preservar o traço usado na interface.
  if (value === null || value === undefined || value === "") return "R$ —";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "R$ —";
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Converte uma data válida para a chave local AAAA-MM-DD, sem deslocamento UTC.
 * @param {Date} date Data a ser convertida.
 * @returns {string} Chave de calendário ou string vazia para data inválida.
 */
export function toDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

/**
 * Formata mês e ano em português brasileiro.
 * @param {Date} date Data de referência.
 * @returns {string} Mês e ano ou mensagem neutra para data inválida.
 */
export function formatMonthLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "Período indisponível";
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/**
 * Formata uma data extensa para cabeçalhos da Agenda.
 * @param {Date} date Data selecionada.
 * @returns {string} Dia da semana, dia e mês.
 */
export function formatDateLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "Data indisponível";
  return date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

/**
 * Formata um instante como horário local de duas casas.
 * @param {string|number|Date} value Instante reconhecido pelo construtor Date.
 * @returns {string} Horário ou traço quando inválido.
 */
export function formatTime(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone });
}

/**
 * Formata um instante como data e horário local.
 * @param {string|number|Date} value Instante reconhecido pelo construtor Date.
 * @returns {string} Data e horário ou traço quando inválido.
 */
export function formatDateTime(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone });
}

/**
 * Traduz a origem de um agendamento para um rótulo apresentado ao profissional.
 * @param {string} source Código de origem persistido no banco.
 * @returns {string} Rótulo em português brasileiro.
 */
export function formatBookingSource(source) {
  return ({ customer: "Cliente", salon: "Salão", professional: "Profissional" })[source] || "Salão";
}

/**
 * Traduz estados de agendamento e comanda sem expor códigos internos.
 * @param {string} status Código de estado persistido no banco.
 * @returns {string} Descrição em português brasileiro.
 */
export function formatStatus(status) {
  const labels = {
    scheduled: "Agendado",
    confirmed: "Confirmado",
    arrived: "Cliente chegou",
    in_progress: "Em atendimento",
    completed: "Finalizado",
    cancelled: "Cancelado",
    no_show: "Falta",
    open: "Aberta",
    awaiting_payment: "Aguardando pagamento",
    partially_paid: "Pagamento parcial",
    closed: "Finalizada"
  };
  return labels[status] || status || "—";
}

/**
 * Determina a classe visual de um cartão de agendamento conforme seu estado.
 * @param {{status?: string}} appointment Agendamento exibido no calendário.
 * @returns {"progress"|"success"|"released"|"scheduled"} Classe CSS sem efeitos colaterais.
 */
export function getAppointmentClass(appointment) {
  if (appointment?.status === "in_progress") return "progress";
  if (appointment?.status === "completed" || appointment?.status === "confirmed") return "success";
  if (appointment?.status === "cancelled" || appointment?.status === "no_show") return "released";
  return "scheduled";
}

/** Identifica a origem de criação, sem confundir cliente, salão e profissional. */
export function formatAppointmentCreator(appointment, salonName) {
  const source=appointment?.booking_source;
  const name=value=>typeof value==="string"?value.trim():"";
  if(source==="customer")return name(appointment.created_by_name)||name(appointment.customer_name)||"Cliente";
  if(source==="salon")return name(salonName)||"Salão";
  if(source==="professional")return name(appointment.created_by_name)||"Profissional não identificado";
  return "Origem não identificada";
}
/** Data de criação real; registros sem data não recebem uma data inventada. */
export function formatAppointmentCreation(value,timeZone){
  return value==null||value===""?"Data de criação indisponível":formatDateTime(value,timeZone);
}
