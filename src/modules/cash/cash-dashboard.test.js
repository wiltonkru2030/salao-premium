/**
 * Testes do componente visual do Caixa.
 * Confirma estados aberto/fechado e que ações dependem da permissão recebida.
 */
import assert from "node:assert/strict";
import { renderCashDashboard } from "./components/cash-dashboard.js";

const closed = renderCashDashboard({
  active:null,activeNet:0,income:0,expense:0,net:0,movements:[],history:"",
  registers:[],canOperate:false
});
assert.match(closed,/Nenhum caixa aberto/);
assert.match(closed,/Seu perfil não pode abrir ou fechar o caixa/);
assert.doesNotMatch(closed,/id="cash-open-form"/);

const open = renderCashDashboard({
  active:{id:"cash-1",opening_amount:100,opened_at:"2026-11-13T10:00:00Z"},
  activeNet:25,income:50,expense:25,net:25,movements:[{}],history:"Movimento teste",
  registers:[],canOperate:true
});
assert.match(open,/Valor de abertura/);
assert.match(open,/id="cash-close-form"/);
assert.match(open,/Movimento teste/);

process.stdout.write("Testes do componente Caixa: OK\n");
