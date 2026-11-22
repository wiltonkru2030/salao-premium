/**
 * Testes do controle de ciclo de vida da sessão, sem chamadas ao Supabase.
 * Protegem contra vazamento de interface entre proprietário e profissional.
 */
import assert from "node:assert/strict";
import { createSessionRevision } from "./session-revision.js";

const guard = createSessionRevision();
const owner = { id: "owner-1" };
const professional = { id: "professional-1" };

assert.equal(guard.observe(owner), true);
const ownerRequest = guard.capture(owner);
assert.equal(guard.isCurrent(ownerRequest), true);
// Refresh não pode invalidar a resolução do tenant ativo.
assert.equal(guard.observe(owner), false);
assert.equal(guard.isCurrent(ownerRequest), true);
// Ao trocar de usuário, o resultado da conta anterior perde validade.
assert.equal(guard.observe(professional), true);
assert.equal(guard.isCurrent(ownerRequest), false);
const professionalRequest = guard.capture(professional);
assert.equal(guard.isCurrent(professionalRequest), true);
// Sign-out invalida até uma resposta que volte depois de novo login no mesmo usuário.
guard.invalidate();
assert.equal(guard.isCurrent(professionalRequest), false);
assert.equal(guard.observe(professional), true);
assert.equal(guard.isCurrent(professionalRequest), false);
assert.equal(guard.isCurrent(guard.capture(professional)), true);
// O retorno sem usuário nunca pode ressuscitar uma consulta antiga.
guard.invalidate();
assert.equal(guard.observe(null), false);
assert.equal(guard.isCurrent(guard.capture(owner)), false);
console.log("Geração de sessão e cancelamento de contexto antigo: OK");
