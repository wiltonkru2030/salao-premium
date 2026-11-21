/**
 * Regressão da identificação de conta no menu do painel.
 * Protege a distinção entre proprietário e login profissional de testes.
 * Testes puros e estáticos: não acessam o Supabase nem alteram usuários.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describeAccessRole } from "./access-role.js";

assert.deepEqual(describeAccessRole("owner"), { label: "Proprietário · painel completo", limited: false });
assert.deepEqual(describeAccessRole("professional"), { label: "Profissional · acesso limitado", limited: true });
assert.equal(describeAccessRole("admin").limited, false);
assert.equal(describeAccessRole("receptionist").limited, false);
assert.equal(describeAccessRole(null).limited, false);

const render = readFileSync(new URL("./render.js", import.meta.url), "utf8");
assert.match(render, /describeAccessRole\(state\.membership\?\.role\)/);
assert.match(render, /class="sidebar-role-label"/);
assert.match(render, /access\.limited\s*\?/);
assert.match(render, /class="sidebar-switch-account" data-action="sign-out"/);

console.log("Identificação de papel e troca de conta no painel: OK");
