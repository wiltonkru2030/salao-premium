/**
 * Entrada independente da Área da Cliente.
 * Oferece OAuth Google e Passkeys do Supabase Auth; não concede acesso a dados do salão
 * até existir vínculo cliente-usuário validado no banco e políticas RLS específicas.
 */
import { supabase } from "../src/supabase/client.js";
import { customerAuthError, safeClientRedirect } from "./auth-utils.js";

const root = document.querySelector("#cliente-app");
let busy = false;

function icon(name) {
  const paths = {
    google: '<path fill="#4285F4" d="M21.6 12.23c0-.72-.06-1.42-.18-2.09H12v3.95h5.38a4.6 4.6 0 0 1-2 3.02v2.52h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.37l-3.24-2.52c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.75-5.59-4.1H3.06v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.41 13.97A6 6 0 0 1 6.1 12c0-.68.12-1.34.31-1.97v-2.6H3.06A10 10 0 0 0 2 12c0 1.62.39 3.15 1.06 4.57l3.35-2.6Z"/><path fill="#EA4335" d="M12 5.93c1.47 0 2.8.5 3.84 1.52l2.88-2.88C16.96 2.93 14.7 2 12 2a10 10 0 0 0-8.94 5.43l3.35 2.6c.79-2.35 2.99-4.1 5.59-4.1Z"/>',
    key: '<path d="M7 14a5 5 0 1 1 4.58-3H22v4h-3v3h-4v-3h-3.42A5 5 0 0 1 7 14Z"/><circle cx="7" cy="9" r="1"/>',
    shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>'
  };
  return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (paths[name] || "") + "</svg>";
}

function render({ title = "Entre para agendar", description = "Acesse seus agendamentos e tenha seus salões favoritos em um só lugar.", notice = "", noticeType = "info", session = null } = {}) {
  const signedIn = Boolean(session?.user);
  root.innerHTML = `
    <section class="client-panel">
      <div class="client-brand"><span class="brand-mark">SP</span><div><strong>SALÃO PREMIUM</strong><small>ÁREA DA CLIENTE</small></div></div>
      <span class="eyebrow">${signedIn ? "ACESSO CONFIRMADO" : "SEU MOMENTO, DO SEU JEITO"}</span>
      <h1 class="client-title">${signedIn ? "Que bom ter você aqui!" : title}</h1>
      <p class="client-description">${signedIn ? "Sua identidade foi confirmada. Estamos preparando a vinculação do seu cadastro de cliente." : description}</p>
      ${notice ? `<div class="client-alert ${noticeType}" role="status">${notice}</div>` : ""}
      ${signedIn ? `
        <div class="client-status">
          <p>${session.user.email ? "Conta Google: " + escapeHtml(session.user.email) : "Conta autenticada com chave de acesso."}</p>
          <button class="client-button" data-action="register-passkey">${icon("key")} Cadastrar chave de acesso neste aparelho</button>
          <p class="client-note">O cadastro de cliente, histórico e agendamentos só serão liberados após vincularmos esta conta ao salão correto com segurança.</p>
          <button class="client-link" data-action="sign-out">Sair da conta</button>
        </div>` : `
        <div class="client-actions">
          <button class="client-button primary" data-action="google">${icon("google")} Continuar com Google</button>
          <button class="client-button" data-action="passkey">${icon("key")} Entrar com chave de acesso</button>
        </div>
        <p class="client-note">${icon("shield")} Seu acesso é protegido. Você não precisa criar uma senha para o SALÃO PREMIUM.</p>
      `}
      <div class="client-foot">SALÃO PREMIUM · Acesso simples e protegido</div>
    </section>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

async function setBusy(action, value) {
  busy = value;
  const button = root.querySelector(`[data-action="${action}"]`);
  if (button) {
    button.disabled = value;
    if (value) button.textContent = "Aguarde…";
  }
}

root.addEventListener("click", async event => {
  const button = event.target.closest("[data-action]");
  if (!button || busy) return;
  const action = button.dataset.action;
  await setBusy(action, true);
  try {
    if (action === "google") {
      const redirectTo = safeClientRedirect(window.location.origin);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, queryParams: { prompt: "select_account" } }
      });
      if (error) throw error;
    } else if (action === "passkey") {
      const { error } = await supabase.auth.signInWithPasskey();
      if (error) throw error;
    } else if (action === "register-passkey") {
      const { error } = await supabase.auth.registerPasskey();
      if (error) throw error;
      const { data } = await supabase.auth.getSession();
      render({ session: data.session, notice: "Chave de acesso cadastrada com sucesso neste aparelho.", noticeType: "success" });
    } else if (action === "sign-out") {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      render();
    }
  } catch (error) {
    render({
      title: "Não foi possível entrar",
      description: "Escolha outra forma de acesso ou tente novamente.",
      notice: customerAuthError(error),
      noticeType: "error"
    });
  } finally {
    busy = false;
    const current = root.querySelector("[data-action]");
    if (current) current.disabled = false;
  }
});

async function start() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    render({ session: data.session });
    supabase.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => render({ session }));
    });
  } catch (error) {
    render({ title: "Acesso temporariamente indisponível", notice: customerAuthError(error), noticeType: "error" });
  }
}

start();