/** Testes das regras de reserva, cupom e vencimento. */
import assert from "node:assert/strict";
import {validateBookingSelection,isHoldExpired,prepareAppointmentChange,selectRescheduleStart} from "./booking-rules.js";
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

// Permissões e seleção de reagendamento: não aceitar dados obsoletos ou índices vazios.
const items=[{appointment_id:"a",starts_at:"2026-11-21T10:00:00Z"}];
const options=[{appointment_id:"a",can_cancel:false,can_reschedule:true,timezone:"America/Sao_Paulo"}];
assert.throws(()=>prepareAppointmentChange({id:"a",items,options,action:"cancel"}));
const change=prepareAppointmentChange({id:"a",items,options,action:"reschedule"});
change.date="2026-11-22";change.slots=[{starts_at:"2026-11-22T10:00:00Z"}];
assert.equal(selectRescheduleStart(change,"0",change.date),change.slots[0].starts_at);
assert.throws(()=>selectRescheduleStart(change,"",change.date));
assert.throws(()=>selectRescheduleStart(change,"0","2026-11-23"));
assert.throws(()=>selectRescheduleStart(change,"1",change.date));
