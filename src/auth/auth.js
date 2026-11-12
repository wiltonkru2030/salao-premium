/** Serviço de autenticação administrativa. Responsabilidade: iniciar sessão, cadastro, recuperação e contexto da organização. */
import { supabase } from '../supabase/client.js';
import { authScreen } from './auth-screen.js';

let authMode = 'login';
let authNotice = '';
let authNoticeType = 'info';
let booted = false;

// Resolve associação, perfil e organização antes de abrir o painel.
export async function getUserContext(user) {
  const { data: membership, error } = await supabase
    .from('org_memberships')
    .select('org_id, role, status')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!membership) throw new Error('Sua conta ainda não está vinculada a um salão ativo.');
  const [profileResult, organizationResult] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    supabase.from('organizations').select('id,name,timezone,currency').eq('id', membership.org_id).maybeSingle()
  ]);
  if (profileResult.error) throw profileResult.error;
  if (organizationResult.error) throw organizationResult.error;
  if (!organizationResult.data) throw new Error('Não foi possível localizar o salão desta conta.');
  return { user, membership, profile: profileResult.data, organization: organizationResult.data };
}

function showAuth(mode = 'login', notice = '', type = 'info') {
  authMode = mode;
  authNotice = notice;
  authNoticeType = type;
  document.querySelector('#app').innerHTML = authScreen(authMode, authNotice, authNoticeType);
}

// Registra sessão, login/cadastro e encaminha o usuário autenticado.
export function startAuth(onAuthenticated) {
  if (booted) return;
  booted = true;
  showAuth('login');
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user && ['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event)) {
      queueMicrotask(async () => {
        try {
          const context = await getUserContext(session.user);
          onAuthenticated(context);
        } catch (error) {
          await supabase.auth.signOut();
          showAuth('login', error.message || 'Não foi possível carregar seu salão.', 'error');
        }
      });
    } else if (event === 'SIGNED_OUT') {
      showAuth('login');
    }
  });
  supabase.auth.getSession().then(async ({ data, error }) => {
    if (error) return showAuth('login', 'Não foi possível recuperar sua sessão. Entre novamente.', 'error');
    if (data.session?.user) {
      try { onAuthenticated(await getUserContext(data.session.user)); }
      catch (err) { showAuth('login', err.message || 'Não foi possível carregar sua conta.', 'error'); }
    } else {
      showAuth('login');
    }
  });

  document.addEventListener('click', event => {
    const switcher = event.target.closest('[data-auth-mode]');
    if (!switcher) return;
    event.preventDefault();
    showAuth(switcher.dataset.authMode === 'signup' ? 'signup' : 'login');
  });

  document.addEventListener('submit', async event => {
    const form = event.target.closest('[data-auth-form]');
    if (!form) return;
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    if (submit) { submit.disabled = true; submit.dataset.originalText = submit.textContent; submit.textContent = 'Aguarde…'; }
    const values = new FormData(form);
    try {
      if (form.dataset.authForm === 'signup') {
        const fullName = String(values.get('full_name') || '').trim();
        const organizationName = String(values.get('organization_name') || '').trim();
        const email = String(values.get('email') || '').trim().toLowerCase();
        const password = String(values.get('password') || '');
        if (password.length < 8) throw new Error('A senha deve ter pelo menos 8 caracteres.');
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName, organization_name: organizationName }, emailRedirectTo: window.location.origin + window.location.pathname }
        });
        if (error) throw error;
        if (data.session) return;
        showAuth('login', 'Cadastro recebido! Confira seu e-mail para confirmar a conta e depois entre no sistema.', 'success');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: String(values.get('email') || '').trim().toLowerCase(),
          password: String(values.get('password') || '')
        });
        if (error) throw error;
      }
    } catch (error) {
      showAuth(authMode, error.message || 'Não foi possível concluir. Tente novamente.', 'error');
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
