/**
 * Módulo: authService.js
 * Responsabilidade: encapsular autenticação global da cliente com Supabase Auth.
 * Google e Passkey comprovam a identidade. PIN de quatro dígitos não é login
 * autônomo nem recuperação de conta; depende de armazenamento seguro nativo.
 */
import { supabase } from "../../src/supabase/client.js";
import { customerAuthError, safeClientRedirect } from "../auth-utils.js";

function unwrap(result, fallback) {
  if (result?.error) {
    const error = new Error(customerAuthError(result.error));
    error.code = result.error.code || "AUTH_ERROR";
    throw error;
  }
  return result?.data ?? null;
}

export async function signInWithGoogle() {
  const redirectTo = safeClientRedirect(window.location.origin);
  return unwrap(await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, queryParams: { prompt: "select_account" } }
  }), "Não foi possível iniciar o acesso com Google.");
}

export async function signInWithPasskey() {
  return unwrap(await supabase.auth.signInWithPasskey());
}

export async function registerPasskey() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(customerAuthError(error));
  if (!data.session?.user) throw new Error("Entre na sua conta antes de cadastrar uma chave de acesso.");
  return unwrap(await supabase.auth.registerPasskey());
}

export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(customerAuthError(error));
  return data.session;
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(customerAuthError(error));
  return data.user;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(customerAuthError(error));
}

export function subscribeToAuthChanges(callback) {
  if (typeof callback !== "function") throw new TypeError("Callback de autenticação inválido.");
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}
