/**
 * Testes de isolamento do estado da carteira de clientes.
 * Responsabilidade: cobrir respostas atrasadas, troca de tenant e atualização da lista.
 */
import assert from "node:assert/strict";
import {createCustomerPageState} from "./customer-page-state.js";

const store=createCustomerPageState();
const host={isConnected:true};
const first=store.begin(host,"org-a");
assert.equal(store.current(host,"org-a"),null);
assert.equal(store.commit(host,first,"org-a",[{id:"old"}]),true);
assert.equal(store.current(host,"org-a").customers[0].id,"old");

const second=store.begin(host,"org-a");
assert.equal(store.current(host,"org-a"),null);
assert.equal(store.commit(host,first,"org-a",[{id:"stale"}]),false);
assert.equal(store.commit(host,second,"org-a",[{id:"new"}]),true);
assert.equal(store.current(host,"org-a").customers[0].id,"new");

// A troca de organização não permite ler ou confirmar dados do tenant anterior.
assert.equal(store.current(host,"org-b"),null);
assert.equal(store.commit(host,second,"org-b",[{id:"private"}]),false);
const third=store.begin(host,"org-b");
assert.equal(store.commit(host,third,"org-b",[{id:"other"}]),true);
assert.equal(store.current(host,"org-a"),null);
assert.equal(store.current(host,"org-b").customers[0].id,"other");

// Uma montagem removida não pode receber dados de uma consulta pendente.
host.isConnected=false;
assert.equal(store.commit(host,third,"org-b",[]),false);
assert.equal(store.current(host,"org-b"),null);
assert.equal(store.current(null,"org-b"),null);
const newHost={isConnected:true};
assert.equal(store.current(newHost,"org-b"),null);
const fourth=store.begin(newHost,"org-b");
assert.equal(store.commit(newHost,fourth,"org-b",[]),true);
assert.deepEqual(store.current(newHost,"org-b").customers,[]);
console.log("Testes de isolamento da página de clientes: OK.");
