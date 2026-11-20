/**
 * Módulo: customerProfileService.js
 * Responsabilidade: consultar e atualizar o perfil global da identidade autenticada.
 * Pré-requisito: migration customer_profiles aplicada com RLS validada.
 * Nunca aceita auth_user_id do navegador; o banco deve usar auth.uid().
 */
import { supabase } from "../../src/supabase/client.js";
import { validateGlobalCustomerProfile } from "../customer-profile-utils.js";

function mapProfile(row) {
  if (!row) return null;
  return {
    fullName: row.full_name,
    phone: row.phone_e164,
    phoneVerifiedAt: row.phone_verified_at,
    email: row.email,
    avatarUrl: row.avatar_url,
    preferences: row.preferences || {}
  };
}

function ensureProfileSchema(error) {
  if (error?.code === "PGRST205" || error?.code === "42P01") {
    const unavailable = new Error("O perfil global ainda está sendo preparado. Seus dados não foram alterados.");
    unavailable.code = "CUSTOMER_PROFILE_NOT_READY";
    throw unavailable;
  }
  throw new Error("Não foi possível acessar seu perfil agora. Tente novamente.");
}

export async function getMyProfile() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("Entre na sua conta para consultar seu perfil.");
  const { data, error } = await supabase.from("customer_profiles")
    .select("auth_user_id,full_name,phone_e164,phone_verified_at,email,avatar_url,preferences")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();
  if (error) ensureProfileSchema(error);
  return mapProfile(data);
}

export async function updateMyProfile(input) {
  const valid = validateGlobalCustomerProfile(input);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("Sua sessão não está disponível. Entre novamente.");
  const { data, error } = await supabase.from("customer_profiles")
    .update({
      full_name: valid.fullName,
      phone_e164: valid.phoneE164,
      email: valid.email,
      avatar_url: valid.avatarUrl,
      updated_at: new Date().toISOString()
    })
    .eq("auth_user_id", userData.user.id)
    .select("auth_user_id,full_name,phone_e164,phone_verified_at,email,avatar_url,preferences")
    .maybeSingle();
  if (error) ensureProfileSchema(error);
  if (!data) throw new Error("Seu perfil global ainda não foi criado. Nenhuma alteração foi salva.");
  return mapProfile(data);
}
