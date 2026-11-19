/**
 * Serviços de identidade de cliente por marca.
 * A autenticação deve ocorrer antes via Google ou Passkey.
 * A RPC usa auth.uid() do token; o navegador não pode escolher a identidade Auth.
 */
import { supabase } from "../src/supabase/client.js";
import { validateCustomerProfile } from "./customer-account-utils.js";

/**
 * Cria ou recupera a conta da cliente na marca informada.
 * O backend correspondente está documentado em docs/sql/cliente-identidade-marca.sql.
 * Não habilitar o fluxo na interface antes da migration ser aplicada e validada em teste.
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

/** Consulta a conta da sessão autenticada na marca selecionada, sempre protegida por RLS. */
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
