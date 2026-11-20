/** Testes das regras de reserva, cupom e vencimento. */
import assert from "node:assert/strict";
import {validateBookingSelection,isHoldExpired} from "./booking-rules.js";
const slot={professional_id:"p",starts_at:"2026-12-01T10:00:00Z"};
const input={index:0,slotsState:{items:[slot],serviceId:"s",date:"2026-12-01",professionalId:"p"},date:"2026-12-01",professionalId:"p",enteredCode:"BLACK",couponState:{serviceId:"s",code:"BLACK",preview:{valid:true}}};
assert.deepEqual(validateBookingSelection(input),{slot,couponCode:"BLACK"});
assert.throws(()=>validateBookingSelection({...input,index:-1}));
assert.throws(()=>validateBookingSelection({...input,date:"2026-12-02"}));
assert.throws(()=>validateBookingSelection({...input,professionalId:"q"}));
assert.throws(()=>validateBookingSelection({...input,enteredCode:"OTHER"}));
assert.equal(validateBookingSelection({...input,enteredCode:""}).couponCode,null);
assert.equal(isHoldExpired({expiresAt:"invalid"},0),true);
assert.equal(isHoldExpired({expiresAt:"2026-12-01T10:00:00Z"},Date.parse("2026-12-01T10:00:00Z")),true);
assert.equal(isHoldExpired({expiresAt:"2026-12-01T10:00:00Z"},0),false);
