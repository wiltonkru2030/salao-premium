/**
 * Configuração pública compartilhada entre os aplicativos do SALÃO PREMIUM.
 * Responsabilidade: centralizar URL e chave publicável; nunca armazenar chaves secretas.
 * Não inicializa cliente nem acessa sessão, evitando efeitos colaterais entre aplicativos.
 */
const defaultUrl = 'https://vlifbvzlyzoncefvfgol.supabase.co';
const defaultPublishableKey = 'sb_publishable_XBXtJ5YbB1rwda7AoAIrwQ_1FR1TfIJ';

const configuredUrl = import.meta.env && import.meta.env.VITE_SUPABASE_URL;
const configuredPublishableKey = import.meta.env && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if ((configuredUrl !== undefined || configuredPublishableKey !== undefined) &&
    (!configuredUrl?.trim() || !configuredPublishableKey?.trim())) {
  throw new Error('Configure juntos a URL e a chave publicável do Supabase.');
}

export const SUPABASE_URL = configuredUrl?.trim() || defaultUrl;
export const SUPABASE_PUBLISHABLE_KEY = configuredPublishableKey?.trim() || defaultPublishableKey;
