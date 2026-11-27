/** Testes de rota de avisos: sessão, unidade, data civil e autorização. */
import assert from "node:assert/strict";
import {readNotificationLink,createNotificationNavigation} from "./notification-navigation.controller.js";
const id="550e8400-e29b-41d4-a716-446655440000", appointment={id:"a",starts_at:"2026-12-01T02:00:00Z"};
assert.equal(readNotificationLink("https://example.org/professional/?notification="+id),id);
assert.equal(readNotificationLink("https://example.org/?notification=invalid"),null);
let epoch=1, rendered=0, notice="";
const state={role:"professional",orgId:"org",branchId:"unit",professional:{id:"p"},organization:{timezone:"America/Campo_Grande"},appointments:[]};
const nav=createNotificationNavigation({state,getEpoch:()=>epoch,fetchNotification:async()=>({id,appointment_id:"a"}),fetchAppointment:async args=>{assert.equal(args.branchId,"unit");assert.equal(args.professionalId,"p");return appointment;},loadAppointments:async()=>{state.appointments=[appointment];},render:()=>rendered++,showNotice:value=>notice=value});
assert.equal(await nav.open(id),true);
assert.equal(state.selectedDate.getMonth(),10);
assert.equal(state.selectedAppointment.id,"a");
assert.equal(rendered,1);
assert.equal(await nav.open("invalid"),false);
const stale=createNotificationNavigation({state,getEpoch:()=>epoch,fetchNotification:async()=>{epoch++;return {id,appointment_id:"a"};},fetchAppointment:async()=>{throw Error("Não deve consultar");},loadAppointments:async()=>{},render:()=>{},showNotice:()=>{}});
assert.equal(await stale.open(id),false);
const denied=createNotificationNavigation({state,getEpoch:()=>epoch,fetchNotification:async()=>({id,appointment_id:"a"}),fetchAppointment:async()=>null,loadAppointments:async()=>{},render:()=>{},showNotice:value=>notice=value});
assert.equal(await denied.open(id),false);assert.match(notice,/indisponível/);
