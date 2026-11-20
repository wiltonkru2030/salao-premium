/** Testes do filtro compartilhado/local do catálogo de serviços. */
import assert from "node:assert/strict";
import { scopeServiceCatalog } from "./service-scope.js";

const calls=[];
const query={
  or(value){calls.push(["or",value]);return this;},
  is(column,value){calls.push(["is",column,value]);return this;}
};

assert.equal(scopeServiceCatalog(query,"branch-123"),query);
assert.deepEqual(calls.pop(),["or","branch_id.is.null,branch_id.eq.branch-123"]);
assert.equal(scopeServiceCatalog(query,null),query);
assert.deepEqual(calls.pop(),["is","branch_id",null]);

process.stdout.write("Testes de escopo do catálogo de serviços: OK\n");
