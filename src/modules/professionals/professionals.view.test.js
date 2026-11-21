/**
 * Testes da interface da equipe: cadastro, vínculos, escape e credenciais.
 */
import assert from "node:assert/strict";
import {renderProfessionalsView} from "./professionals.view.js";
const workspace={professionals:[{id:"p1",name:"<script>teste</script>",active:true}],services:[{id:"s1",name:"Corte",category:"Cabelo"}],assignments:[{professional_id:"p1",service_id:"s1"}],members:[],profiles:[]};
const initialPasswords=new Map([["p1","senha-de-teste"]]);
const html=renderProfessionalsView(workspace,{canManage:true,initialPasswords});
assert.ok(html.includes('id="professional-create-form"'));
assert.ok(html.includes('data-mask="cpf"'));
assert.ok(html.includes('data-mask="cnpj"'));
assert.ok(html.includes("Corte"));
// Regressão visual/funcional: edição acessível somente para perfis autorizados.
assert.ok(html.includes('data-edit-professional="p1"'));
assert.ok(html.includes('name="professional_id"'));
assert.ok(html.includes('id="professional-edit-services-notice"'));
assert.ok(html.includes('id="professional-new-services-help"'));
assert.ok(html.includes('id="professional-app-access-heading"'));
assert.ok(!renderProfessionalsView(workspace,{canManage:false}).includes('data-edit-professional="p1"'));
assert.ok(!html.includes("<script>"));
assert.ok(html.includes("senha-de-teste"));
assert.ok(!renderProfessionalsView(workspace,{canManage:false,initialPasswords}).includes("senha-de-teste"));
assert.ok(renderProfessionalsView({professionals:[]}).includes("Sua equipe começa aqui"));
console.log("Testes da interface de profissionais: OK.");
