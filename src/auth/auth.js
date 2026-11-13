/**
 * Serviço de autenticação administrativa e seleção explícita do tenant.
 * Resolve identidade, membership e organização antes de inicializar qualquer módulo.
 * Não usa user_metadata para decidir permissões.
 */
import { supabase } from "../supabase/client.js";
import { authScreen, organizationSelectionScreen } from "./auth-screen.js";
import { userErrorMessage } from "../utils/errors.js";
import { state } from "../state.js";
import { resolveTenantMemberships } from "./tenant-context.js";

let authMode = "login";
let authNotice = "";
let authNoticeType = "info";
let booted = false;

// Resolve todos os tenants acessíveis e exige escolha explícita quando há mais de um.
export async function getUserContext(user, selectedOrgId = null) {
  const { data: memberships, error: membershipError } = await supabase
    .from("org_memberships")
    .select("org_id,role,status")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (membershipError) throw membershipError;
  if (!memberships?.length) throw new Error("Sua conta ainda não está vinculada a um salão ativo.");

  const orgIds = [...new Set(memberships.map(item => item.org_id))];
  const [profileResult, organizationsResult] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("organizations").select("id,name,timezone,currency").in("id", orgIds)
  ]);

  if (profileResult.error) throw profileResult.error;
  if (organizationsResult.error) throw organizationsResult.error;

  const tenant = resolveTenantMemberships(memberships, organizationsResult.data || [], selectedOrgId);
  if (tenant.requiresOrganizationSelection) {
    return { ...tenant, user, profile: profileResult.data };
  }
  return { user, membership: tenant.membership, profile: profileResult.data, organization: tenant.organization, availableOrganizations: tenant.availableOrganizations };
}

/** Recarrega o contexto da sessão para trocar de organização sem misturar estado entre tenants. */
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
export function startAuth(onAuthenticated) {
  if (booted) return;
  booted = true;
  let pendingUser = null;
  let resolvingUserId = null;
  let activeUserId = null;

  const activateUser = async (user, selectedOrgId = null) => {
    if (!user || activeUserId === user.id || resolvingUserId === user.id) return;
    if (!selectedOrgId && pendingUser?.id === user.id) return;
    resolvingUserId = user.id;
    try {
      const context = await getUserContext(user, selectedOrgId);
      if (context.requiresOrganizationSelection) {
        pendingUser = user;
        showOrganizationSelection(context.organizations);
        return;
      }
      pendingUser = null;
      activeUserId = user.id;
      onAuthenticated(context);
    } catch (error) {
      pendingUser = null;
      await supabase.auth.signOut();
      showAuth("login", userErrorMessage(error), "error");
    } finally {
      resolvingUserId = null;
    }
  };

  showAuth("login");
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user && ["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"].includes(event)) {
      queueMicrotask(() => activateUser(session.user));
    } else if (event === "SIGNED_OUT") {
      pendingUser = null;
      activeUserId = null;
      resolvingUserId = null;
      state.user = null;
      state.profile = null;
      state.organization = null;
      state.membership = null;
      state.availableOrganizations = [];
      state.branch = null;
      state.drawer = null;
      state.agendaAppointments = [];
      state.agendaProfessionals = [];
      state.dbBlockedTimes = [];
      showAuth("login");
    }
  });

  supabase.auth.getSession().then(async ({ data, error }) => {
    if (error) return showAuth("login", userErrorMessage(error), "error");
    if (data.session?.user) await activateUser(data.session.user);
    else showAuth("login");
  });

  document.addEventListener("submit", async event => {
    const form = event.target.closest("[data-organization-form]");
    if (!form) return;
    event.preventDefault();
    const orgId = String(new FormData(form).get("org_id") || "");
    const button = form.querySelector('[type="submit"]');
    if (!pendingUser || !orgId) {
      showOrganizationSelection([], "Sua sessão precisa ser atualizada. Entre novamente.");
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

  document.addEventListener("click", event => {
    const switcher = event.target.closest("[data-auth-mode]");
    if (!switcher) return;
    event.preventDefault();
    showAuth(switcher.dataset.authMode === "signup" ? "signup" : "login");
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
      if (form.dataset.authForm === "signup") {
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
      showAuth(authMode, userErrorMessage(error), "error");
    } finally {
      const current = document.querySelector('[data-auth-form] [type="submit"]');
      if (current) current.disabled = false;
    }
  });
}

// Encerra a sessão Supabase e propaga falhas ao chamador.
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
