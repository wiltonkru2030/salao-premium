/** Testes da navegação: autorização, carregamento sob demanda e falhas locais. */
import assert from "node:assert/strict";
import {createNavigationController} from "./navigation.controller.js";
import {createProfessionalState} from "../workspace-state.js";
const state=Object.assign(createProfessionalState(),{role:"professional",scope:"self",professional:{id:"p"}});
const calls=[];let epoch=1;
const track=name=>async()=>{calls.push(name);};
const deps={state,root:{querySelector:()=>null},getEpoch:()=>epoch,render:()=>{},showNotice:message=>calls.push(message),loadOrders:track("orders"),loadServices:track("services"),loadServiceCatalog:track("catalog"),canManageServices:()=>false,loadCustomers:track("customers"),loadCommissions:track("commissions"),loadNotifications:track("notifications"),loadProfilePreferences:track("profile"),profilePreferencesEnabled:true};
const nav=createNavigationController(deps);
await nav.navigate("Agenda");assert.deepEqual(calls,[]);
await nav.navigate("Comandas");assert.deepEqual(calls,["orders","services"]);
await nav.navigate("Comissões");assert.equal(calls.at(-1),"commissions");
await nav.navigate("Caixa");assert.equal(state.page,"Comissões");
await nav.navigate("Serviços");assert.equal(calls.at(-1),"services");
await createNavigationController({...deps,loadOrders:async()=>{throw Error("offline")}}).navigate("Comandas");
assert.ok(calls.some(value=>value.includes("Não foi possível")));
console.log("Navegação e carregamento sob demanda: OK");
