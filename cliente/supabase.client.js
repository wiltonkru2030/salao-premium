/**
 * Sessão exclusiva da Área da Cliente.
 * Responsabilidade: impedir que Google/Passkey substituam o login do proprietário
 * ou do profissional quando os três aplicativos usam o mesmo domínio.
 * Todas as consultas protegidas seguem RLS e o usuário autenticado nesta sessão.
 * Não importa o cliente pronto do painel administrativo nem armazena chaves secretas.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../src/supabase/config.js';

export const CUSTOMER_AUTH_STORAGE_KEY = 'salao-premium-customer-auth-v1';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storageKey: CUSTOMER_AUTH_STORAGE_KEY,
    autoRefreshToken: true,
    persistSession: true,
    // Google OAuth retorna ao /cliente/ com o código PKCE para esta sessão.
    detectSessionInUrl: true,
    flowType: 'pkce',
    experimental: { passkey: true }
  }
});
