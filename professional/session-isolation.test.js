/**
 * Teste de regressão para a separação entre sessões do painel e do App Profissional.
 * Responsabilidade: impedir que uma importação futura volte a compartilhar o token.
 * Usa leitura estática: não cria sessões, não acessa rede e não expõe credenciais.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const professionalApp = read('./app.js');
const professionalClient = read('./supabase.client.js');
const adminClient = read('../src/supabase/client.js');

assert.match(professionalApp, /from ["']\.\/supabase\.client\.js["']/);
assert.doesNotMatch(professionalApp, /from ["']\.\.\/src\/supabase\/client\.js["']/);
assert.match(professionalClient, /storageKey:\s*PROFESSIONAL_AUTH_STORAGE_KEY/);
assert.match(professionalClient, /PROFESSIONAL_AUTH_STORAGE_KEY\s*=\s*['"]salao-premium-professional-auth-v1['"]/);
assert.doesNotMatch(professionalClient, /from ["']\.\.\/src\/supabase\/client\.js["']/);
assert.match(adminClient, /export\s+const\s+supabase\s*=\s*createClient/);
assert.doesNotMatch(adminClient, /salao-premium-professional-auth-v1/);
console.log('Isolamento de sessão entre painel e profissional: OK');
