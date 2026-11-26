/**
 * Serviço de consulta dos agendamentos do App Profissional.
 *
 * Responsabilidade: executar a leitura mensal de agendamentos permitidos pela organização.
 * Ecossistema: App Profissional (PWA) do SALÃO PREMIUM.
 * Integração: recebe o cliente Supabase injetado pelo app.js e devolve registros
 * para o estado da aplicação; não acessa DOM, não renderiza telas e não decide permissões.
 */

/**
 * Busca os agendamentos de um mês para a organização autenticada.
 *
 * Passos:
 * 1. Valida o cliente Supabase, a organização e o mês recebido.
 * 2. Calcula o intervalo [primeiro dia do mês, primeiro dia do mês seguinte).
 * 3. Consulta apenas registros pertencentes à organização informada.
 * 4. Ordena por início e limita o volume para proteger o desempenho da tela.
 * 5. Converte falhas técnicas em uma mensagem segura para a interface.
 *
 * @param {object} options Dependências e filtros da consulta.
 * @param {object} options.client Cliente Supabase já configurado.
 * @param {string} options.organizationId Identificador da organização ativa.
 * @param {Date} options.month Qualquer data pertencente ao mês desejado.
 * @param {number} [options.limit=1000] Limite máximo de registros retornados.
 * @returns {Promise<Array<object>>} Agendamentos ordenados por data de início.
 * @throws {TypeError} Quando os parâmetros forem inválidos.
 * @throws {Error} Quando a consulta falhar, com mensagem segura em pt-BR.
 */
export async function fetchProfessionalAppointments({
  client,
  organizationId,
  month,
  professionalId = null,
  limit = 1000
}) {
  if (!client || typeof client.from !== "function") {
    throw new TypeError("O serviço de agendamentos não recebeu uma conexão válida.");
  }
  if (typeof organizationId !== "string" || !organizationId.trim()) {
    throw new TypeError("Não foi possível identificar o salão desta conta.");
  }
  if (!(month instanceof Date) || Number.isNaN(month.getTime())) {
    throw new TypeError("O mês informado para a Agenda é inválido.");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 5000) {
    throw new TypeError("O limite de agendamentos solicitado é inválido.");
  }

  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);

  try {
    let query = client
      .from("appointments")
      .select("id,starts_at,ends_at,customer_id,customer_name,customer_phone,service_name,professional_name,status,price,booking_source,created_by_name,notes,professional_id,appointment_group_id,service_order_id,branch_id")
      .eq("org_id", organizationId)
      .gte("starts_at", start.toISOString())
      .lt("starts_at", end.toISOString());
    // O escopo individual não depende apenas das permissões amplas de uma conta administrativa.
    if (professionalId) query = query.eq("professional_id", professionalId);
    const { data, error } = await query.order("starts_at")
      .limit(limit);

    if (error) {
      // Detalhes do Supabase não são enviados à interface nem ao usuário final.
      const safeError = new Error("Não foi possível carregar os agendamentos. Verifique sua conexão e tente novamente.");
      safeError.code = "PROFESSIONAL_APPOINTMENTS_FETCH_FAILED";
      throw safeError;
    }

    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (error?.code === "PROFESSIONAL_APPOINTMENTS_FETCH_FAILED") throw error;
    const safeError = new Error("Não foi possível carregar os agendamentos. Verifique sua conexão e tente novamente.");
    safeError.code = "PROFESSIONAL_APPOINTMENTS_FETCH_FAILED";
    throw safeError;
  }
}

/** Solicita alteração de estado de um agendamento próprio e confere o retorno do servidor. */
export async function updateOwnAppointmentStatus({client, organizationId, appointmentId, status}) {
  const {data, error} = await client.rpc("set_own_appointment_status", {
    target_org: organizationId,
    target_appointment: appointmentId,
    next_status: status
  });
  if (error || data?.id !== appointmentId || data.status !== status) {
    throw new Error("Não foi possível alterar o agendamento. Atualize a Agenda e tente novamente.");
  }
  return data;
}

/** Envia o horário civil para o banco converter no fuso do salão e preservar a duração. */
export async function rescheduleOwnAppointment({client, organizationId, appointment, localStart}) {
  const {data, error} = await client.rpc("reschedule_own_appointment", {
    target_org: organizationId,
    target_appointment: appointment.id,
    expected_start: appointment.starts_at,
    new_local_start: localStart
  });

  if (error?.code === "23P01" || error?.code === "23514") {
    throw new Error("O novo horário está indisponível. Confira o expediente e escolha outro.");
  }
  if (error || data?.id !== appointment.id || !data.starts_at || !data.ends_at) {
    throw new Error("Não foi possível reagendar. Atualize a Agenda e escolha um horário futuro.");
  }
  return data;
}
