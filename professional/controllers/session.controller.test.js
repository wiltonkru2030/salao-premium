/** Regressão de troca de unidade, perda de rede e descarte de contexto. */
import assert from "node:assert/strict";
import {createSessionController} from "./session.controller.js";
import {createProfessionalState,resetProfessionalState} from "../workspace-state.js";
let epoch=0,signouts=0,rendered=0,loginCount=0,failBranch=false,failOrg=false;
const user={id:"u"},state=createProfessionalState(),root={innerHTML:""};
state.user=user;state.orgId="o";state.appointments=[{id:"old"}];
const tables={org_memberships:[{org_id:"o",role:"professional",status:"active"}],professionals:[{id:"p",org_id:"o",profile_id:"u",branch_id:"b",active:true,access_enabled:true}],organizations:[{id:"o",name:"QA",timezone:"America/Campo_Grande"}],branches:[{id:"b",name:"Matriz"}],profiles:{full_name:"QA"}};
const client={auth:{getUser:async()=>({data:{user}}),signOut:async()=>{signouts++;return {error:null};}},from(table){return {select(){return this;},eq(){return this;},in(){return this;},order(){return this;},maybeSingle(){return this;},then(resolve){return Promise.resolve((table==="branches"&&failBranch||table==="organizations"&&failOrg)?{error:{message:"offline"}}:{data:tables[table]}).then(resolve);}};}};
const controller=createSessionController({state,root,supabase:client,getEpoch:()=>epoch,clearPrivateState:()=>{epoch++;resetProfessionalState(state);},clearAutocomplete:()=>{},loginView:()=>loginCount++,changePasswordView:()=>{},render:()=>rendered++,reportError:()=>{},loadAppointments:async()=>{},loadNotifications:async()=>{},notificationsEnabled:false});
failBranch=true;await controller.switchContext("o","b");
assert.match(root.innerHTML,/Tentar novamente/);assert.equal(state.appointments.length,0);assert.equal(state.user,null);assert.equal(signouts,0);
failBranch=false;state.user=user;await controller.switchContext("o","b");assert.equal(state.branchId,"b");assert.equal(rendered,1);
failOrg=true;await controller.switchContext("o");assert.match(root.innerHTML,/Tentar novamente/);assert.equal(signouts,0);assert.equal(state.orgId,null);
failOrg=false;state.user=user;await controller.switchContext("o","b");assert.equal(state.branchId,"b");
tables.branches=[];await controller.switchContext("o","b");assert.equal(signouts,1);assert.equal(loginCount,1);assert.equal(state.user,null);
console.log("Controlador de sessão profissional: OK");
