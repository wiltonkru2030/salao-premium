/** Testes de rota de avisos: sessão, unidade, data civil e autorização. */
import assert from "node:assert/strict";
import {readNotificationLink,createNotificationNavigation} from "./notification-navigation.controller.js";
const id="550e8400-e29b-41d4-a716-446655440000", appointment={id:"a",branch_id:"unit",starts_at:"2026-12-01T02:00:00Z"};
assert.equal(readNotificationLink("https://example.org/professional/?notification="+id),id);
assert.equal(readNotificationLink("https://example.org/?notification=invalid"),null);
let epoch=1, rendered=0, notice="";
const state={role:"professional",orgId:"org",branchId:"unit",professional:{id:"p"},organization:{timezone:"America/Campo_Grande"},appointments:[]};
const nav=createNotificationNavigation({state,getEpoch:()=>epoch,fetchNotification:async()=>({id,appointment_id:"a"}),fetchAppointment:async args=>{assert.deepEqual(args.branchIds,["unit"]);assert.equal(args.professionalId,"p");return appointment;},loadAppointments:async()=>{state.appointments=[appointment];},render:()=>rendered++,showNotice:value=>notice=value});
assert.equal(await nav.open(id),true);
assert.equal(state.selectedDate.getMonth(),10);
assert.equal(state.selectedAppointment.id,"a");
assert.equal(rendered,1);
assert.equal(await nav.open("invalid"),false);
const stale=createNotificationNavigation({state,getEpoch:()=>epoch,fetchNotification:async()=>{epoch++;return {id,appointment_id:"a"};},fetchAppointment:async()=>{throw Error("Não deve consultar");},loadAppointments:async()=>{},render:()=>{},showNotice:()=>{}});
assert.equal(await stale.open(id),false);
const denied=createNotificationNavigation({state,getEpoch:()=>epoch,fetchNotification:async()=>({id,appointment_id:"a"}),fetchAppointment:async()=>null,loadAppointments:async()=>{},render:()=>{},showNotice:value=>notice=value});
assert.equal(await denied.open(id),false);assert.match(notice,/indisponível/);

state.branches=[{id:"unit"},{id:"other"}];
let switched=null;
const cross=createNotificationNavigation({state,getEpoch:()=>epoch,fetchNotification:async()=>({id,appointment_id:"a"}),fetchAppointment:async args=>{assert.deepEqual(args.branchIds,["unit","other"]);return {...appointment,branch_id:"other"};},loadAppointments:async()=>{throw Error("Não deve misturar unidades");},render:()=>{},showNotice:()=>{},switchBranch:async(branch,notification)=>{switched={branch,notification};return true;}});
assert.equal(await cross.open(id),true);assert.deepEqual(switched,{branch:"other",notification:id});
const forbidden=createNotificationNavigation({state,getEpoch:()=>epoch,fetchNotification:async()=>({id,appointment_id:"a"}),fetchAppointment:async()=>({...appointment,branch_id:"forbidden"}),loadAppointments:async()=>{},render:()=>{},showNotice:()=>{},switchBranch:async()=>{throw Error("Unidade não autorizada");}});
assert.equal(await forbidden.open(id),false);

let readArgs, refreshed=0;
const opened=createNotificationNavigation({state,getEpoch:()=>epoch,fetchNotification:async()=>({id,appointment_id:"a"}),fetchAppointment:async()=>appointment,loadAppointments:async()=>{state.appointments=[appointment];},render:()=>{},showNotice:()=>{},markRead:async(...args)=>{readArgs=args;},refreshInbox:()=>{refreshed++;}});
assert.equal(await opened.open(id),true);assert.deepEqual(readArgs,["org",id]);assert.equal(refreshed,1);
