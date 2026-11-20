import assert from "node:assert/strict";
import { distanceInKm, validateCoordinates } from "./geoSalonService.js";
import { validateBookingSelection } from "./bookingService.js";
import { normalizeCouponCode } from "./couponService.js";
import { getLocalSettings, saveLocalSettings } from "./settingsService.js";

assert.deepEqual(validateCoordinates(-20.7849, -51.7007), { latitude: -20.7849, longitude: -51.7007 });
assert.throws(() => validateCoordinates(91, 0), /localização informada é inválida/i);
assert.ok(distanceInKm({latitude:0,longitude:0},{latitude:0,longitude:1}) > 111 && distanceInKm({latitude:0,longitude:0},{latitude:0,longitude:1}) < 112);
assert.throws(() => distanceInKm({latitude:100,longitude:0},{latitude:0,longitude:0}), /localização informada é inválida/i);
const future = new Date(Date.now() + 86400000).toISOString();
assert.deepEqual(validateBookingSelection({orgId:"org-1",branchId:"branch-1",serviceIds:["service-1","service-1"],startsAt:future}), {
  orgId:"org-1",branchId:"branch-1",serviceIds:["service-1"],professionalId:null,startsAt:new Date(future).toISOString()
});
assert.throws(() => validateBookingSelection({orgId:"org-1",branchId:"branch-1",serviceIds:[],startsAt:future}), /selecione pelo menos um serviço/i);
assert.throws(() => validateBookingSelection({orgId:"org-1",branchId:"branch-1",serviceIds:["s"],startsAt:new Date(Date.now()-1000).toISOString()}), /data e um horário futuros/i);
assert.equal(normalizeCouponCode(" primeira-visita "), "PRIMEIRA-VISITA");
assert.throws(() => normalizeCouponCode("!"), /código promocional válido/i);
assert.equal(getLocalSettings().theme, "system");
console.log("Testes dos serviços-base da cliente concluídos.");
