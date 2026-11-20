/** Teste estático de descarte de respostas antigas da Agenda complementar.
 * Confere as proteções de identidade; não substitui teste de navegador.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync("src/agenda/controllers/agenda-offers.controller.js","utf8");
assert.match(source,/if\(st\.loading\)return;\s*const seq=\+\+ctrl\.seq;/);
assert.match(source,/const seq=\+\+ctrl\.matchSeq;/);
assert.match(source,/ctrl\.data===st&&ctrl\.matchSeq===seq/);
assert.match(source,/ctrl\.seq\+\+;ctrl\.matchSeq\+\+;ctrl\.customerSeq\+\+;/);
assert.match(source,/ctrl\.data!==st\|\|!ctrl\.root\.isConnected/);
assert.match(source,/root\._offersController\.data=null/);
console.log("Proteção de sessão da Agenda complementar: OK");
