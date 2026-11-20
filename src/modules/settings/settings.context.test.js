/**
 * Regressões do contexto administrativo.
 * Valida que a visualização de Configurações não deve sobrescrever a filial operacional.
 */
import assert from "node:assert/strict";
import {resolveSettingsBranch} from "./settings.context.js";

const matriz={id:"matriz",name:"Matriz",is_main:true,active:true};
const centro={id:"centro",name:"Centro",is_main:false,active:true};
const inativa={id:"inativa",name:"Inativa",active:false};
const units=[matriz,centro,inativa];
const all={id:null,name:"Todas as unidades",isAll:true};
assert.equal(resolveSettingsBranch({units,operationalBranch:all}).selectedBranch.id,"matriz");
assert.equal(all.id,null,"A resolução não pode alterar a seleção operacional");
assert.equal(resolveSettingsBranch({units,operationalBranch:centro}).selectedBranch.id,"centro");
assert.equal(resolveSettingsBranch({units,selectedBranchId:"matriz",operationalBranch:centro}).selectedBranch.id,"matriz");
assert.equal(resolveSettingsBranch({units,selectedBranchId:"desconhecido",operationalBranch:centro}).selectedBranch.id,"centro");
assert.equal(resolveSettingsBranch({units,selectedBranchId:"inativa",operationalBranch:centro}).selectedBranch.id,"inativa");
const professional=resolveSettingsBranch({units,role:"professional",operationalBranch:centro,selectedBranchId:"matriz"});
assert.deepEqual(professional.units.map(unit=>unit.id),["centro"]);
assert.equal(professional.selectedBranch.id,"centro");
assert.equal(resolveSettingsBranch({units,role:"professional",operationalBranch:all}).selectedBranch,null);
assert.equal(resolveSettingsBranch({units:[]}).selectedBranch,null);
console.log("Contexto administrativo de unidades: OK");
