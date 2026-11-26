/** Contrato estático do design system. Não substitui testes visuais no navegador. */
import assert from "node:assert/strict";
import { renderClientShell } from "../../cliente/ui/clientShell.js";
import {readFileSync,existsSync} from "node:fs";
import {dirname,resolve} from "node:path";
const read=path=>readFileSync(path,"utf8");
const entries=["styles.css","cliente/styles.css","professional/styles.css"];
function visit(path,stack=[]){
 assert.ok(!stack.includes(path),"Importação circular: "+path);
 assert.ok(existsSync(path),"CSS ausente: "+path);
 const content=read(path);
 const imports=[...content.matchAll(/@import\s+url\(["']?([^"'\)]+)["']?\)/g)].map(m=>m[1].split("?")[0]).filter(x=>!/^https?:/.test(x));
 const visited=new Set([path]);
 for(const relative of imports){
  const nested=resolve(dirname(path),relative);
  for(const file of visit(nested,[...stack,path]))visited.add(file);
 }
 return visited;
}
for(const entry of entries){
 const graph=visit(resolve(entry));
 assert.ok(graph.has(resolve("src/styles/design-tokens.css")),entry+" sem tokens");
 assert.ok(graph.has(resolve("src/styles/shared-controls.css")),entry+" sem componentes compartilhados");
}
const tokens=read("src/styles/design-tokens.css");
assert.match(tokens,/--sp-font-ui:[^;]*Poppins/);
assert.match(tokens,/--sp-font-heading:[^;]*Body Grotesque Fit/);
assert.match(tokens,/--sp-control-height:44px/);
const controls=read("src/styles/shared-controls.css");
assert.match(controls,/prefers-reduced-motion/);
assert.match(controls,/focus-visible/);
assert.match(controls,/dialog\.sp-modal:not\(\[open\]\)/);
assert.match(controls,/\.sp-modal-body\{flex:1;min-height:0/);
assert.match(tokens,/data-theme="dark"/);
assert.match(read("cliente/styles/theme.css"),/--color-bg:var\(--sp-canvas\)/);
assert.match(read("src/modules/quotes/components/quote-components.js"),/<dialog id="quote-quick-customer" class="sp-modal"/);
for(const path of ["src/app.js","professional/app.js","cliente/app.js"])assert.match(read(path),/installGlobalMasks\(\)/);
const clientShell = renderClientShell('<h1>Meus horários</h1>');
assert.match(clientShell, /class="client-app-shell"/);
assert.match(clientShell, /class="sp-platform-mark brand-logo"/);
assert.match(clientShell, /<main><h1>Meus horários<\/h1><\/main>/);
assert.match(clientShell, /data-bottom-nav/);
console.log("Contrato visual compartilhado: OK");

// Protege as superfícies que misturavam valores fixos e cores do tema.
assert.match(read("src/styles/settings.css"),/\.availability-form\{[^}]*background:var\(--sp-paper\);color:var\(--sp-ink\)/);
assert.match(read("src/styles/design-modals.css"),/\.demo-note\{[^}]*background:var\(--sp-soft\);color:var\(--sp-muted\)/);
assert.match(read("src/styles/design-components.css"),/\.section-heading h2,\.section-title h2\{[^}]*color:var\(--sp-ink\)/);
assert.match(read("src/styles/shell-base.css"),/\.unit-indicator\{[^}]*color:var\(--sp-muted\)/);

// Os bloqueios usam a mesma paleta nos calendários diário e semanal.
const agendaLayout = read("src/agenda/styles/agenda.css");
assert.match(agendaLayout,/\.blocked-slot\{[^}]*background:repeating-linear-gradient\(135deg,var\(--sp-soft\) 0 6px,var\(--sp-gold-soft\) 6px 12px\);color:var\(--sp-gold-text\)/);
assert.match(agendaLayout,/\.week-blocked\{[^}]*background:var\(--sp-gold-soft\);color:var\(--sp-gold-text\)/);
