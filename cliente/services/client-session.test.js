/**
 * Regressão da restauração de sessão na Área da Cliente.
 * Responsabilidade: detectar login piscando, spinner infinito e respostas
 * atrasadas após logout, sem acessar rede ou banco de dados.
 */
import assert from "node:assert/strict";
import { startClientSession } from "./client-session.js";

const tick = () => new Promise(resolve => setTimeout(resolve, 15));

/** Cria um ambiente mínimo com os mesmos contratos do controlador real. */
function setup(getUser = async () => ({ id: "cliente-a" })) {
  let callback = null;
  let userId = null;
  let epoch = 0;
  let session = null;
  let signOutCalls = 0;
  const events = [];

  startClientSession({
    subscribeToAuthChanges(fn) { callback = fn; },
    getCurrentUser: getUser,
    async signOut() { signOutCalls++; },
    getUserId: () => userId,
    setSession(value) { session = value; },
    resetAccountState(nextUserId) { userId = nextUserId; epoch++; },
    getEpoch: () => epoch,
    isCurrent: ticket => ticket === epoch,
    requireCurrent: ticket => {
      if (ticket !== epoch) throw new Error("Sessão alterada.");
    },
    renderLogin(message) { events.push(["login", message || ""]); },
    renderLoading() { events.push(["loading"]); },
    async loadProfile() { events.push(["profile"]); },
    async loadPublicSalons() { events.push(["salons"]); },
    async loadFavorites() { events.push(["favorites"]); },
    renderApp() { events.push(["app"]); }
  });

  return {
    emit(sessionValue) { callback(sessionValue); },
    events,
    getSession: () => session,
    getSignOutCalls: () => signOutCalls
  };
}

// Sem usuário salvo: a tela aguarda INITIAL_SESSION e só então mostra login.
const empty = setup();
assert.deepEqual(empty.events, [["loading"]]);
empty.emit(null);
assert.deepEqual(empty.events, [["loading"], ["login", ""]]);

// Com sessão persistida: nunca exibir login entre a página e o painel.
const restored = setup();
restored.emit({ user: { id: "cliente-a" } });
await tick();
assert.equal(restored.events.some(([name]) => name === "login"), false);
assert.equal(restored.events.at(-1)[0], "app");
// Atualização do token da mesma identidade não deve remontar a interface.
const rendered = restored.events.length;
restored.emit({ user: { id: "cliente-a" } });
await tick();
assert.equal(restored.events.length, rendered);
restored.emit(null);
assert.equal(restored.events.at(-1)[0], "login");

// A resposta de uma conta anterior é ignorada se ocorrer logout na consulta.
let resolveLookup;
const delayed = setup(() => new Promise(resolve => { resolveLookup = resolve; }));
delayed.emit({ user: { id: "cliente-a" } });
await tick();
delayed.emit(null);
resolveLookup({ id: "cliente-a" });
await tick();
assert.equal(delayed.events.some(([name]) => name === "app"), false);
assert.equal(delayed.getSignOutCalls(), 0);
assert.equal(delayed.getSession(), null);
console.log("Restauração sem piscar login e descarte de sessão antiga: OK");
