/**
 * Testes do componente visual do Caixa.
 * Confirma seleção de unidade, estados aberto/fechado e ações condicionadas à permissão.
 */
import assert from "node:assert/strict";
import { renderCashDashboard } from "./components/cash-dashboard.js";

const closed = renderCashDashboard({
  active:null,activeNet:0,income:0,expense:0,net:0,movements:[],history:"",
  registers:[],branches:[{id:"branch-1",name:"Unidade Centro",is_main:true}],selectedBranchId:"branch-1",canOperate:false
});
assert.match(closed,/Nenhum caixa aberto nesta unidade/);
assert.match(closed,/Seu perfil não pode abrir ou fechar o caixa/);
assert.match(closed,/id="cash-branch-select"/);
assert.match(closed,/Unidade Centro · Matriz/);
assert.match(closed,/value="branch-1" selected/);
assert.doesNotMatch(closed,/id="cash-open-form"/);

const open = renderCashDashboard({
  active:{id:"cash-1",opening_amount:100,opened_at:"2026-11-13T10:00:00Z"},
  activeNet:25,income:50,expense:25,net:25,movements:[{}],history:"Movimento teste",
  registers:[],branches:[],selectedBranchId:"",canOperate:true
});
assert.match(open,/Valor de abertura/);
assert.match(open,/id="cash-close-form"/);
assert.match(open,/Movimento teste/);
assert.match(open,/Caixa central \(sem filial\)/);

process.stdout.write("Testes do componente Caixa: OK\n");
