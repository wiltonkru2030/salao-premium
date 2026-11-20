/**
 * Regressão de estado das páginas de catálogo.
 * Verifica atualização, montagem removida e isolamento entre organizações.
 */
import assert from "node:assert/strict";
import {createCatalogPageState} from "./catalog-page-state.js";

const store=createCatalogPageState();
const host={isConnected:true};
const initial=store.begin(host,"org-a");
assert.equal(store.current(host,"org-a"),null);
assert.equal(store.commit(host,initial,"org-a",[{id:"one"}]),true);
assert.equal(store.current(host,"org-a").rows[0].id,"one");
const refresh=store.begin(host,"org-a");
assert.equal(store.commit(host,initial,"org-a",[{id:"stale"}]),false);
assert.equal(store.current(host,"org-a"),null);
assert.equal(store.commit(host,refresh,"org-a",[{id:"two"}]),true);
assert.equal(store.current(host,"org-a").rows.find(row=>row.id==="one"),undefined);
assert.equal(store.current(host,"org-a").rows[0].id,"two");
assert.equal(store.current(host,"org-b"),null);
assert.equal(store.commit(host,refresh,"org-b",[{id:"private"}]),false);
const switched=store.begin(host,"org-b");
assert.equal(store.commit(host,switched,"org-b",[]),true);
assert.equal(store.current(host,"org-a"),null);
const other={isConnected:true};
const independent=store.begin(other,"org-b");
assert.equal(store.commit(other,independent,"org-b",[{id:"three"}]),true);
assert.deepEqual(store.current(host,"org-b").rows,[]);
host.isConnected=false;
assert.equal(store.isCurrent(host,switched,"org-b"),false);
assert.equal(store.current(host,"org-b"),null);
assert.equal(store.current(null,"org-b"),null);
console.log("Testes de estado do catálogo: OK");
