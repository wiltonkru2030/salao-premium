/**
 * Serviços da identidade de cliente por marca.
 * Uma pessoa tem uma conta por organização, enquanto os cadastros operacionais
 * existentes por filial são vinculados separadamente, sem mesclar histórico automaticamente.
 *
 * O backend correspondente está documentado em docs/sql/cliente-identidade-marca.sql.
 * Não liberar o fluxo na interface antes de aplicar e validar a migration em ambiente de teste.
 */
import { supabase } from "../src/supabase/client.js";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Normaliza e valida o nome informado pela própria cliente. */
export function normalizeCustomerName(value) {
  const name = String(value ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 120) {
    throw new Error("Informe seu nome completo (de 2 a 120 caracteres).");
  }
  return name;
}

/** Normaliza o slug público da marca, sem aceitar caminhos ou URLs arbitrárias. */
export function normalizeOrganizationSlug(value) {
  const slug = String(value ?? "").trim().toLowerCase();
  if (!SLUG_PATTERN.test(slug) || slug.length > 80) {
    throw new Error("O link do salão é inválido. Peça o link correto à recepção.");
  }
  return slug;
}

/** Valida data civil sem conversões de fuso horário. A data não autentica a cliente. */
export function validateBirthDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const birthDate = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    throw new Error("Confira a data de nascimento.");
  }
  const [year, month, day] = birthDate.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const normalized = parsed.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  if (normalized !== birthDate || year < 1900 || birthDate > today) {
    throw new Error("Informe uma data de nascimento válida.");
  }
  return birthDate;
}

/** Valida e prepara o perfil mínimo antes de enviar ao Supabase. */
export function validateCustomerProfile({ organizationSlug, fullName, birthDate = null }) {
  return {
    organizationSlug: normalizeOrganizationSlug(organizationSlug),
    fullName: normalizeCustomerName(fullName),
    birthDate: validateBirthDate(birthDate)
  };
}

/**
 * Cria (ou recupera) a conta da cliente na marca indicada.
 * A autenticação deve ter sido concluída antes por Google ou Passkey.
 * A RPC do banco associa exclusivamente auth.uid(); não aceita user_id do navegador.
 */
export async function registerCustomerAccount(profile) {
  const valid = validateCustomerProfile(profile);
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Entre com sua conta antes de criar seu cadastro de cliente.");

  const { data, error } = await supabase.rpc("register_customer_account", {
    p_org_slug: valid.organizationSlug,
    p_full_name: valid.fullName,
    p_birth_date: valid.birthDate
  });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") {
      throw new Error("O cadastro de cliente ainda está sendo preparado. Nenhum dado foi alterado.");
    }
    throw new Error("Não foi possível criar seu cadastro agora. Tente novamente.");
  }
  if (!data) throw new Error("O servidor não confirmou o cadastro. Tente novamente.");
  return data;
}

/** Busca apenas a conta da cliente autenticada dentro da marca selecionada (RLS obrigatório). */
export async function getMyCustomerAccount(organizationId) {
  if (!organizationId) throw new Error("Selecione o salão para continuar.");
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Entre com sua conta para consultar seu cadastro.");

  const { data, error } = await supabase.from("customer_accounts")
    .select("id,org_id,full_name,birth_date,created_at")
    .eq("org_id", organizationId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível consultar seu cadastro. Tente novamente.");
  return data;
}
