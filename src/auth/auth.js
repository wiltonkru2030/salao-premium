/**
 * Serviço de autenticação administrativa e seleção explícita do tenant.
 * Resolve identidade, membership e organização antes de inicializar qualquer módulo.
 * Não usa user_metadata para decidir permissões.
 */
import { supabase } from "../supabase/client.js";
import { authScreen, organizationSelectionScreen } from "./auth-screen.js";
import { userErrorMessage, reportError } from "../utils/errors.js";
import { state } from "../state.js";
import { resolveTenantMemberships } from "./tenant-context.js";
import { createSessionRevision } from "./session-revision.js";

let authMode = "login";
let authNotice = "";
let authNoticeType = "info";
let booted = false;
let passwordRecoveryInProgress = false;

// Resolve todos os tenants acessíveis e exige escolha explícita quando há mais de um.
/** Resolve associações ativas e organização selecionada; não usa metadados do usuário para conceder permissões. */
export async function getUserContext(user, selectedOrgId = null) {
  const { data: memberships, error: membershipError } = await supabase
    .from("org_memberships")
    .select("org_id,role,status")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (membershipError) throw new Error("Não foi possível consultar seu vínculo com o salão. Verifique sua conexão e tente novamente.", { cause: membershipError });
  if (!memberships?.length) throw new Error("Sua conta ainda não está vinculada a um salão ativo.");

  const orgIds = [...new Set(memberships.map(item => item.org_id))];
  const [profileResult, organizationsResult] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("organizations").select("id,name,timezone,currency").in("id", orgIds)
  ]);

  if (profileResult.error) throw new Error("Não foi possível carregar seu perfil. Tente novamente.", { cause: profileResult.error });
  if (organizationsResult.error) throw new Error("Não foi possível carregar os dados do salão. Tente novamente.", { cause: organizationsResult.error });

  const tenant = resolveTenantMemberships(memberships, organizationsResult.data || [], selectedOrgId);
  if (tenant.requiresOrganizationSelection) {
    return { ...tenant, user, profile: profileResult.data };
  }
  return { user, membership: tenant.membership, profile: profileResult.data, organization: tenant.organization, availableOrganizations: tenant.availableOrganizations };
}

/** Recarrega o contexto da sessão para trocar de organização sem misturar estado entre tenants. */
/** Carrega o contexto de sessão e tenant solicitado após validar a associação ativa. */
export async function getCurrentUserContext(organizationId) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("Sua sessão expirou. Entre novamente.");
  return getUserContext(user, organizationId);
}

function showAuth(mode = "login", notice = "", type = "info") {
  authMode = mode;
  authNotice = notice;
  authNoticeType = type;
  document.querySelector("#app").innerHTML = authScreen(authMode, authNotice, authNoticeType);
}

function showOrganizationSelection(organizations, notice = "") {
  document.querySelector("#app").innerHTML = organizationSelectionScreen(organizations, notice);
}

// Inicia sessão, resolve o tenant e só então entrega o contexto ao painel.
/** Inicializa o fluxo de autenticação, observa a sessão e entrega o contexto validado ao painel. */
export function startAuth(onAuthenticated) {
  if (booted) return;
  booted = true;
  let pendingUser = null;
  let resolvingUserId = null;
  let activeUserId = null;
  const sessionRevision = createSessionRevision();

  /** Limpa os dados do painel quando outra identidade entra ou a sessão termina. */
  const clearAccountState = () => {
    state.user = null;
    state.profile = null;
    state.organization = null;
    state.membership = null;
    state.availableOrganizations = [];
    state.availableBranches = [];
    state.branch = null;
    state.drawer = null;
    state.page = "Dashboard";
    state.mobileMenu = false;
    state.agendaAppointments = [];
    state.agendaProfessionals = [];
    state.dbBlockedTimes = [];
  };

  /** Evita mostrar o formulário de login antes da restauração segura da sessão. */
  const showLoading = () => {
    const app = document.querySelector("#app");
    if (app) app.innerHTML = '<main class="auth-shell"><section class="auth-panel" role="status" aria-live="polite"><div class="auth-heading"><span class="auth-eyebrow">SALÃO PREMIUM</span><h1>Preparando seu salão…</h1><p>Verificando sua sessão com segurança.</p></div></section></main>';
  };

  /** Descarta respostas atrasadas que pertencem a uma sessão substituída. */
  const activateUser = async (user, selectedOrgId = null) => {
    if (!user || activeUserId === user.id || resolvingUserId === user.id) return;
    if (!selectedOrgId && pendingUser?.id === user.id) return;
    const ticket = sessionRevision.capture(user);
    const isCurrent = () => sessionRevision.isCurrent(ticket);
    if (!isCurrent()) return;
    resolvingUserId = user.id;
    try {
      const context = await getUserContext(user, selectedOrgId);
      if (!isCurrent()) return;
      if (context.requiresOrganizationSelection) {
        pendingUser = user;
        showOrganizationSelection(context.organizations);
        return;
      }
      pendingUser = null;
      // O carregamento de filiais também é assíncrono: aguardar a montagem segura.
      await onAuthenticated(context, isCurrent);
      if (isCurrent()) activeUserId = user.id;
    } catch (error) {
      if (!isCurrent()) return;
      pendingUser = null;
      const diagnostic = reportError(error, { context: "Painel > carregar organização após login", notify: false });
      // A falha do tenant não invalida a senha nem a sessão: oferecer nova tentativa.
      activeUserId = null;
      showAuth("login", `${diagnostic.message} (Código ${diagnostic.id})`, "error");
      document.querySelector(".auth-notice")?.insertAdjacentHTML("beforeend", '<p><button type="button" data-auth-retry-context>Tentar carregar meu salão novamente</button></p>');
    } finally {
      if (resolvingUserId === user.id) resolvingUserId = null;
    }
  };

  showLoading();
  // INITIAL_SESSION substitui uma segunda leitura getSession() que podia disputar
  // com SIGNED_IN/SIGNED_OUT e restaurar uma identidade antiga depois da troca.
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      sessionRevision.invalidate();
      pendingUser = null;
      activeUserId = null;
      resolvingUserId = null;
      passwordRecoveryInProgress = false;
      clearAccountState();
      showAuth("login");
      return;
    }

    if (event === "PASSWORD_RECOVERY" && session?.user) {
      sessionRevision.observe(session.user);
      pendingUser = null;
      activeUserId = null;
      resolvingUserId = null;
      clearAccountState();
      passwordRecoveryInProgress = true;
      queueMicrotask(() => showAuth("recovery-update", "Defina uma nova senha para sua conta.", "info"));
      return;
    }

    if (!["INITIAL_SESSION", "SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"].includes(event)) return;
    const user = session?.user;
    if (!user) {
      if (event === "INITIAL_SESSION") {
        sessionRevision.invalidate();
        clearAccountState();
        showAuth("login");
      }
      return;
    }

    if (sessionRevision.observe(user)) {
      // Ao alternar entre proprietário e profissional, nunca reaproveitar a
      // navegação, os dados nem a seleção de filial da identidade anterior.
      pendingUser = null;
      activeUserId = null;
      resolvingUserId = null;
      clearAccountState();
      showLoading();
    }
    if (passwordRecoveryInProgress) return;
    queueMicrotask(() => activateUser(user));
  });

  document.addEventListener("submit", async event => {
    const form = event.target.closest("[data-organization-form]");
    if (!form) return;
    event.preventDefault();
    const orgId = String(new FormData(form).get("org_id") || "");
    const button = form.querySelector('[type="submit"]');
    if (!pendingUser || !orgId) {
      showAuth("login", "Sua sessão expirou. Entre novamente.", "error");
      return;
    }
    button.disabled = true;
    button.textContent = "Carregando organização…";
    await activateUser(pendingUser, orgId);
    if (button.isConnected) {
      button.disabled = false;
      button.textContent = "Entrar nesta organização";
    }
  });

  // Reusa a sessão autenticada quando a consulta ao tenant falha; não pede senha novamente.
  document.addEventListener("click", async event => {
    const button = event.target.closest("[data-auth-retry-context]");
    if (!button || button.disabled) return;
    button.disabled = true;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!data.session?.user) {
        showAuth("login", "Sua sessão expirou. Entre novamente.", "error");
        return;
      }
      await activateUser(data.session.user);
    } catch (error) {
      const diagnostic = reportError(error, { context: "Painel > recuperar sessão", notify: false });
      showAuth("login", diagnostic.message + " (Código " + diagnostic.id + ")", "error");
    } finally { if (button.isConnected) button.disabled = false; }
  });

  document.addEventListener("click", event => {
    const switcher = event.target.closest("[data-auth-mode]");
    if (!switcher) return;
    event.preventDefault();
    const nextMode = ["signup", "recovery-request"].includes(switcher.dataset.authMode) ? switcher.dataset.authMode : "login";
    showAuth(nextMode);
  });

  document.addEventListener("submit", async event => {
    const form = event.target.closest("[data-auth-form]");
    if (!form) return;
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    if (submit) {
      submit.disabled = true;
      submit.dataset.originalText = submit.textContent;
      submit.textContent = "Aguarde…";
    }
    const values = new FormData(form);
    try {
      if (form.dataset.authForm === "recovery-request") {
        const email = String(values.get("email") || "").trim().toLowerCase();
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
        if (error) throw error;
        showAuth("login", "Se o endereço estiver cadastrado, você receberá um link para redefinir sua senha.", "success");
      } else if (form.dataset.authForm === "recovery-update") {
        const password = String(values.get("password") || "");
        const confirmation = String(values.get("password_confirmation") || "");
        if (password.length < 8) throw new Error("A senha deve ter pelo menos 8 caracteres.");
        if (password !== confirmation) throw new Error("As senhas informadas não são iguais.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        passwordRecoveryInProgress = false;
        await supabase.auth.signOut({ scope: "local" });
        showAuth("login", "Senha alterada com sucesso. Entre com sua nova senha.", "success");
      } else if (form.dataset.authForm === "signup") {
        const fullName = String(values.get("full_name") || "").trim();
        const organizationName = String(values.get("organization_name") || "").trim();
        const email = String(values.get("email") || "").trim().toLowerCase();
        const password = String(values.get("password") || "");
        if (password.length < 8) throw new Error("A senha deve ter pelo menos 8 caracteres.");
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName, organization_name: organizationName }, emailRedirectTo: window.location.origin + window.location.pathname }
        });
        if (error) throw error;
        if (data.session) return;
        showAuth("login", "Cadastro recebido! Confira seu e-mail para confirmar a conta e depois entre no sistema.", "success");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: String(values.get("email") || "").trim().toLowerCase(),
          password: String(values.get("password") || "")
        });
        if (error) throw error;
      }
    } catch (error) {
      const diagnostic = reportError(error, { context: `Painel > formulário ${form.dataset.authForm}`, notify: false });
      showAuth(authMode, `${diagnostic.message} (Código ${diagnostic.id})`, "error");
    } finally {
      const current = document.querySelector('[data-auth-form] [type="submit"]');
      if (current) current.disabled = false;
    }
  });
}

// Encerra a sessão Supabase e propaga falhas ao chamador.
/**
 * Encerra a sessão autenticada no Supabase.
 * @returns {Promise<void>} Resolve após encerrar a sessão.
 * @throws {Error} Quando o Supabase não consegue encerrar a sessão.
 */
// Ao trocar de conta no painel, não encerrar outras sessões independentes.
export async function signOut() {
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw error;
}
