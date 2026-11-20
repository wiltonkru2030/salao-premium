/**
 * Repositório Supabase da Agenda administrativa.
 * Responsabilidade: consultar e persistir agendamentos com escopo obrigatório por organização.
 * Ecossistema: Painel web SALÃO PREMIUM.
 * Segurança: RLS e triggers do banco são a barreira final; validações locais são apenas auxiliares.
 */

import { checkAvailability } from "./availability.service.js";

const PAGE_SIZE = 250;
const ALLOWED_STATUSES = new Set(["scheduled","confirmed","arrived","in_progress","completed","cancelled","no_show"]);

/**
 * Valida dependências e escopo do tenant antes de acessar a tabela.
 * @param {object} client Cliente Supabase injetado.
 * @param {string} orgId Organização ativa.
 * @throws {TypeError} Se conexão ou organização não forem informadas.
 */
function validateContext(client, orgId) {
  if (!client || typeof client.from !== "function") throw new TypeError("A conexão com a Agenda não está disponível.");
  if (typeof orgId !== "string" || !orgId.trim()) throw new TypeError("A organização ativa não foi identificada.");
}

/**
 * Converte timestamp em data/hora local para validação de conflito na interface.
 * @param {object} row Registro de agendamento do banco.
 * @returns {object} Campos usados pelo validador local.
 */
function toCandidate(row) {
  const start = new Date(row.starts_at);
  const end = new Date(row.ends_at);
  const valid = Number.isFinite(start.getTime()) && Number.isFinite(end.getTime());
  return {
    id: row.id,
    name: row.customer_name || "",
    service: row.service_name || "",
    pro: row.professional_id || "",
    date: valid ? [start.getFullYear(),String(start.getMonth()+1).padStart(2,"0"),String(start.getDate()).padStart(2,"0")].join("-") : "",
    time: valid ? [String(start.getHours()).padStart(2,"0"),String(start.getMinutes()).padStart(2,"0")].join(":") : "",
    duration: valid ? Math.round((end.getTime()-start.getTime())/60000) : 0,
    status: row.status
  };
}

/**
 * Normaliza dados de formulário para o contrato da tabela appointments.
 * @param {object} input Dados recebidos da interface.
 * @param {string} orgId Organização ativa.
 * @returns {object} Payload com timestamps e nomes persistidos.
 * @throws {TypeError} Quando faltarem campos obrigatórios.
 */
function normalizePayload(input, orgId) {
  const start = input.starts_at ? new Date(input.starts_at) : new Date(String(input.date || "") + "T" + String(input.time || "") + ":00");
  const end = input.ends_at
    ? new Date(input.ends_at)
    : new Date(start.getTime() + Number(input.duration || 0) * 60000);
  const customerName = String(input.customer_name || input.name || "").trim();
  const serviceName = String(input.service_name || input.service || "").trim();
  const professionalId = input.professional_id || (typeof input.pro === "string" ? input.pro : "");
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    throw new TypeError("Informe data, horário e duração válidos.");
  }
  if (!customerName || !serviceName || !professionalId || !input.customer_id || !input.service_id) {
    throw new TypeError("Selecione cliente, serviço e profissional válidos.");
  }
  if (typeof input.branch_id !== "string" || !input.branch_id.trim()) {
    throw new TypeError("Selecione a unidade do salão antes de agendar.");
  }
  if (end.getTime()-start.getTime() > 720*60000) throw new TypeError("A duração do atendimento ultrapassa o limite permitido.");
  const price = Number(input.price);
  if (!Number.isFinite(price) || price < 0) throw new TypeError("Informe um valor válido para o serviço.");
  return {
    org_id: orgId,
    branch_id: input.branch_id.trim(),
    customer_id: input.customer_id,
    professional_id: professionalId,
    service_id: input.service_id,
    customer_name: customerName,
    customer_phone: input.customer_phone || input.phone || null,
    service_name: serviceName,
    professional_name: input.professional_name || null,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    price,
    notes: String(input.notes || "").trim() || null,
    status: input.status || "scheduled",
    booking_source: input.booking_source || "salon"
  };
}

/**
 * Traduz falhas do PostgREST em mensagens seguras para o painel.
 * @param {object} error Erro retornado pelo Supabase.
 * @returns {Error} Erro sem SQL ou detalhes internos.
 */
function mapAgendaError(error) {
  const code = error?.code;
  const message = code === "23P01" || code === "23505"
    ? "Este horário acabou de ser ocupado. Atualize a agenda e escolha outro."
    : code === "42501"
      ? "Você não tem permissão para realizar esta alteração."
      : "Não foi possível salvar ou consultar a agenda. Verifique sua conexão e tente novamente.";
  const failure = new Error(message);
  failure.code = code || "AGENDA_OPERATION_FAILED";
  return failure;
}

/**
 * Lê todas as páginas de agendamentos dentro do escopo do tenant.
 * @param {object} client Cliente Supabase.
 * @param {string} orgId Organização ativa.
 * @param {object} filters Filtros opcionais de data, profissional e status.
 * @returns {Promise<Array<object>>} Agendamentos persistidos.
 * @throws {Error} Em falha de consulta; nunca devolve lista parcial.
 */
async function readAllAppointments(client, orgId, filters = {}) {
  const rows = [];
  try {
    for (let offset=0; ; offset+=PAGE_SIZE) {
      let query = client.from("appointments").select("*").eq("org_id",orgId);
      if (filters.branchId) query = query.eq("branch_id", filters.branchId);
      if (filters.date) {
        const start = new Date(filters.date + "T00:00:00");
        if (!Number.isFinite(start.getTime())) throw new TypeError("Data de filtro inválida.");
        const end = new Date(start.getTime()+86400000);
        query = query.gte("starts_at",start.toISOString()).lt("starts_at",end.toISOString());
      }
      if (filters.startAt) query = query.gte("starts_at", filters.startAt);
      if (filters.endAt) query = query.lt("starts_at", filters.endAt);
      const professionalId = filters.professionalId || filters.professional_id || null;
      if (professionalId) query = query.eq("professional_id",professionalId);
      if (filters.status && filters.status !== "Todos") query = query.eq("status",filters.status);
      const {data,error} = await query.order("starts_at",{ascending:true}).range(offset,offset+PAGE_SIZE-1);
      if (error) throw error;
      const page = Array.isArray(data) ? data : [];
      rows.push(...page);
      if (page.length<PAGE_SIZE) break;
    }
    const term = String(filters.query || "").trim().toLocaleLowerCase("pt-BR");
    return term ? rows.filter(row =>
      [row.customer_name,row.service_name,row.customer_phone,row.professional_name]
        .some(value=>String(value||"").toLocaleLowerCase("pt-BR").includes(term))
    ) : rows;
  } catch (error) {
    if (error instanceof TypeError) throw error;
    throw mapAgendaError(error);
  }
}

/**
 * Lista agendamentos reais com paginação e filtros de tenant.
 * @param {object} options Cliente, organização e filtros.
 * @returns {Promise<Array<object>>} Registros do banco.
 * @throws {TypeError|Error} Para contexto inválido ou falha de consulta.
 */
export async function listAppointments({client,orgId,...filters}={}) {
  validateContext(client,orgId);
  return readAllAppointments(client,orgId,filters);
}

/**
 * Busca um agendamento pelo UUID dentro da organização ativa.
 * @param {string} id UUID do agendamento.
 * @param {object} context Cliente Supabase e orgId.
 * @returns {Promise<object|null>} Registro encontrado ou null.
 * @throws {TypeError|Error} Para contexto inválido ou falha de leitura.
 */
export async function getAppointment(id,{client,orgId}={}) {
  validateContext(client,orgId);
  if(typeof id!=="string"||!id.trim()) throw new TypeError("Identificador do agendamento inválido.");
  try {
    const {data,error}=await client.from("appointments").select("*").eq("org_id",orgId).eq("id",id).maybeSingle();
    if(error)throw error;
    return data||null;
  } catch(error) { throw mapAgendaError(error); }
}

/**
 * Valida criação contra os agendamentos existentes; o banco repete a validação ao inserir.
 * @param {object} input Payload do novo agendamento.
 * @param {object} context Cliente, organização e expediente local.
 * @returns {Promise<object>} Resultado ok, erros e prévia normalizada.
 */
export async function previewCreateAppointment(input,{client,orgId,opening="08:00",closing="20:00"}={}) {
  validateContext(client,orgId);
  const payload=normalizePayload(input,orgId);
  const candidate=toCandidate(payload);
  const existing=await readAllAppointments(client,orgId,{date:candidate.date});
  const validation=checkAvailability(candidate,existing.map(toCandidate),{opening,closing});
  return {ok:validation.valid,errors:validation.errors,preview:payload};
}

/**
 * Cria agendamento persistido após validação local; trigger/RPC do banco decide conflitos concorrentes.
 * @param {object} input Payload do novo agendamento.
 * @param {object} context Cliente, organização e expediente.
 * @returns {Promise<object>} Resultado com registro salvo ou erros de validação.
 * @throws {Error} Em falha de gravação.
 */
export async function createAppointment(input,{client,orgId,opening,closing}={}) {
  validateContext(client,orgId);
  const preview=await previewCreateAppointment(input,{client,orgId,opening,closing});
  if(!preview.ok)return {ok:false,errors:preview.errors};
  try {
    const {data,error}=await client.from("appointments").insert(preview.preview).select("*").single();
    if(error)throw error;
    return {ok:true,appointment:data};
  } catch(error) { throw mapAgendaError(error); }
}

/**
 * Atualiza um agendamento e revalida conflitos ignorando o próprio registro.
 * @param {string} id UUID do agendamento.
 * @param {object} changes Campos permitidos para alteração.
 * @param {object} context Cliente, organização e expediente.
 * @returns {Promise<object>} Resultado da atualização ou mensagens de validação.
 * @throws {TypeError|Error} Em identificador inválido ou falha de persistência.
 */
export async function updateAppointment(id,changes,{client,orgId,opening="08:00",closing="20:00"}={}) {
  validateContext(client,orgId);
  const current=await getAppointment(id,{client,orgId});
  if(!current)return {ok:false,errors:["Agendamento não encontrado."]};
  const payload=normalizePayload({...current,...changes},orgId);
  const candidate=toCandidate({...payload,id});
  const existing=await readAllAppointments(client,orgId,{date:candidate.date});
  const validation=checkAvailability(candidate,existing.map(toCandidate),{opening,closing});
  if(!validation.valid)return {ok:false,errors:validation.errors};
  try {
    const {data,error}=await client.from("appointments").update(payload).eq("org_id",orgId).eq("id",id).select("*").single();
    if(error)throw error;
    return {ok:true,appointment:data};
  } catch(error) { throw mapAgendaError(error); }
}

/**
 * Simula reagendamento sem gravar dados no banco.
 * @param {string} id UUID do agendamento.
 * @param {object} changes Novos campos de data, hora, duração ou profissional.
 * @param {object} context Cliente, organização e expediente.
 * @returns {Promise<object>} Resultado de validação e prévia.
 */
export async function previewMoveAppointment(id,changes,context={}) {
  const current=await getAppointment(id,context);
  if(!current)return {ok:false,errors:["Agendamento não encontrado."]};
  const payload=normalizePayload({...current,...changes},context.orgId);
  const candidate=toCandidate({...payload,id});
  const existing=await readAllAppointments(context.client,context.orgId,{date:candidate.date});
  const validation=checkAvailability(candidate,existing.map(toCandidate),{opening:context.opening||"08:00",closing:context.closing||"20:00"});
  return {ok:validation.valid,errors:validation.errors,preview:payload};
}

/**
 * Altera status e registra timestamp correspondente.
 * @param {string} id UUID do agendamento.
 * @param {string} status Novo status do domínio.
 * @param {object} context Cliente Supabase e organização.
 * @returns {Promise<object>} Agendamento atualizado.
 * @throws {TypeError|Error} Para status inválido ou falha de persistência.
 */
export async function changeAppointmentStatus(id,status,{client,orgId}={}) {
  validateContext(client,orgId);
  if(typeof id!=="string"||!id.trim()||!ALLOWED_STATUSES.has(status)) throw new TypeError("Identificador ou status do agendamento inválido.");
  const changes={status};
  if(status==="arrived")changes.arrived_at=new Date().toISOString();
  if(status==="cancelled")changes.cancelled_at=new Date().toISOString();
  if(status==="completed")changes.completed_at=new Date().toISOString();
  try {
    const {data,error}=await client.from("appointments").update(changes).eq("org_id",orgId).eq("id",id).select("*").single();
    if(error)throw error;
    return {ok:true,appointment:data};
  } catch(error) { throw mapAgendaError(error); }
}

/**
 * Fachada de métodos do repositório para adaptadores da Agenda.
 * @param {object} filters Filtros do método chamado.
 * @param {object} context Cliente Supabase e organização ativa.
 * @returns {Promise<object|Array<object>>} Resultado do método solicitado.
 */
export const agendaRepository = Object.freeze({
  list: (filters,context) => listAppointments({...filters,...context}),
  get: (id,context) => getAppointment(id,context),
  create: (input,context) => createAppointment(input,context),
  move: (id,changes,context) => previewMoveAppointment(id,changes,context),
  update: (id,changes,context) => updateAppointment(id,changes,context)
});
