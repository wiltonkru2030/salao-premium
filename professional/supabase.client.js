/**
 * Cliente Supabase exclusivo do App Profissional.
 * Responsabilidade: manter o token do profissional separado da sessão administrativa
 * quando ambos os aplicativos são abertos no mesmo navegador/domínio.
 * Importante: nunca importar o cliente pronto de src/supabase/client.js aqui,
 * pois ele usa o armazenamento legado do painel e substituiria sua sessão.
 * O servidor continua validando organização, papel e permissões via RLS/RPC.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../src/supabase/config.js';

export const PROFESSIONAL_AUTH_STORAGE_KEY = 'salao-premium-professional-auth-v1';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storageKey: PROFESSIONAL_AUTH_STORAGE_KEY,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce'
  }
});
