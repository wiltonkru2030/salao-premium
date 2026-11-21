/**
 * Regressão de autenticação entre Painel, App Profissional e Área da Cliente.
 * Responsabilidade: impedir reintrodução de imports com armazenamento compartilhado.
 * Teste estático, sem rede, banco de dados ou credenciais reais.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("./", import.meta.url));
const read = relative => readFileSync(new URL(relative, import.meta.url), "utf8");

/** Encontra módulos da cliente para verificar cada import, inclusive arquivos futuros. */
function listModules(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listModules(path)
      : entry.isFile() && entry.name.endsWith(".js") && !entry.name.endsWith(".test.js") ? [path] : [];
  });
}

const customerClient = read("./supabase.client.js");
const professionalClient = read("../professional/supabase.client.js");
const adminClient = read("../src/supabase/client.js");
const customerKey = customerClient.match(/CUSTOMER_AUTH_STORAGE_KEY\s*=\s*["']([^"']+)["']/)?.[1];
const professionalKey = professionalClient.match(/PROFESSIONAL_AUTH_STORAGE_KEY\s*=\s*["']([^"']+)["']/)?.[1];

assert.ok(customerKey, "Área da Cliente precisa de chave própria.");
assert.ok(professionalKey, "App Profissional precisa de chave própria.");
assert.notEqual(customerKey, professionalKey, "Cliente e profissional não podem dividir sessão.");
assert.doesNotMatch(adminClient, /salao-premium-(?:customer|professional)-auth-v1/);
assert.match(customerClient, /storageKey:\s*CUSTOMER_AUTH_STORAGE_KEY/);
assert.match(customerClient, /detectSessionInUrl:\s*true/);
assert.match(customerClient, /flowType:\s*["']pkce["']/);
assert.match(customerClient, /passkey:\s*true/);

for(const path of listModules(root)) {
  const source = readFileSync(path, "utf8");
  assert.doesNotMatch(source, /from\s*["'](?:\.\.\/)+src\/supabase\/client\.js["']/, 
    "A Área da Cliente não pode importar o cliente administrativo: " + path);
}
for(const relative of ["app.js", "services/authService.js", "services/appointmentHoldService.js",
  "services/customerProfileService.js", "services/customerIdentityLinkService.js"]) {
  assert.match(read("./" + relative), /from\s*["'](?:\.\.\/|\.\/)supabase\.client\.js["']/,
    "Este módulo deve usar a sessão exclusiva da cliente: " + relative);
}
console.log("Isolamento de sessões dos três aplicativos: OK");
