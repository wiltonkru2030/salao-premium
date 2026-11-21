/** Inicialização do cliente Supabase. Contém apenas URL e chave publicável; nunca adicionar service_role aqui. */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0';

import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';
export { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    // Passkeys são experimentais no Supabase Auth; habilita a API do app cliente.
    experimental: { passkey: true }
  }
});
