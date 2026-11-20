/**
 * Testes do serviço de disponibilidade e reservas da Área da Cliente.
 * Responsabilidade: validar payloads, normalização e mapeamento seguro de erros.
 * Ecossistema: PWA da cliente SALÃO PREMIUM.
 */
import assert from "node:assert/strict";
import {
  getAvailableSlots,
  createBookingHold,
  confirmBooking,
  releaseBookingHold,
  validateBookingSelection
} from "./bookingService.js";

const orgId = "11111111-1111-4111-8111-111111111111";
const branchId = "22222222-2222-4222-8222-222222222222";
const professionalId = "33333333-3333-4333-8333-333333333333";
const serviceId = "44444444-4444-4444-8444-444444444444";
const holdId = "55555555-5555-4555-8555-555555555555";
const appointmentId = "66666666-6666-4666-8666-666666666666";

function mockClient(responses) {
  const calls = [];
  const client = {
    rpc(name, args) {
      calls.push({ name, args });
      const response = responses[name];
      return Promise.resolve(typeof response === "function" ? response(args) : response);
    }
  };
  return { client, calls };
}

async function run() {
  const slots = [{ professional_id: professionalId, starts_at: "2026-12-01T12:00:00Z" }];
  const availability = mockClient({
    get_customer_available_slots: { data: slots, error: null }
  });
  assert.deepEqual(await getAvailableSlots({
    client: availability.client, orgId, branchId, serviceId,
    date: "2026-12-01", professionalId, intervalMinutes: 15
  }), slots);
  assert.deepEqual(availability.calls[0], {
    name: "get_customer_available_slots",
    args: {
      p_org_id: orgId, p_branch_id: branchId, p_service_id: serviceId,
      p_date: "2026-12-01", p_professional_id: professionalId, p_interval_minutes: 15
    }
  });

  const future = new Date(Date.now() + 86400000).toISOString();
  assert.deepEqual(validateBookingSelection({
    orgId, branchId, serviceIds: [serviceId, serviceId], startsAt: future
  }).serviceIds, [serviceId]);

  const create = mockClient({
    create_customer_appointment_hold_with_coupon: {
      data: [{ hold_id: holdId, expires_at: "2026-12-01T12:05:00Z", coupon_id: null, coupon_discount_amount: 0, coupon_final_amount: 120 }], error: null
    }
  });
  assert.deepEqual(await createBookingHold({
    client: create.client, orgId, branchId, professionalId, serviceId, startsAt: future
  }), { holdId, expiresAt: "2026-12-01T12:05:00.000Z", couponId: null, discountAmount: 0, finalAmount: 120 });

  const confirm = mockClient({
    confirm_customer_appointment_hold_with_coupon: { data: appointmentId, error: null }
  });
  assert.equal(await confirmBooking({ client: confirm.client, holdId }), appointmentId);

  const cancel = mockClient({
    cancel_customer_appointment_hold_with_coupon: { data: true, error: null }
  });
  assert.equal(await releaseBookingHold({ client: cancel.client, holdId }), true);

  await assert.rejects(() => getAvailableSlots({
    client: availability.client, orgId, branchId, serviceId, date: "01/12/2026"
  }), { name: "TypeError" });
  await assert.rejects(() => getAvailableSlots({
    client: availability.client, orgId, branchId, serviceId, date: "2026-12-01", intervalMinutes: 2
  }), { name: "TypeError" });
  await assert.rejects(() => createBookingHold({
    client: create.client, orgId, branchId, professionalId, serviceId, startsAt: "invalid"
  }), { name: "TypeError" });

  const missing = mockClient({
    get_customer_available_slots: { data: null, error: { code: "PGRST202", message: "SQL interno" } }
  });
  await assert.rejects(() => getAvailableSlots({
    client: missing.client, orgId, branchId, serviceId, date: "2026-12-01"
  }), error => error.code === "BOOKING_BACKEND_NOT_READY"
    && error.message.includes("ainda está sendo ativada")
    && !error.message.includes("SQL interno"));

  const conflict = mockClient({
    create_customer_appointment_hold_with_coupon: { data: null, error: { code: "23P01" } }
  });
  await assert.rejects(() => createBookingHold({
    client: conflict.client, orgId, branchId, professionalId, serviceId, startsAt: future
  }), error => error.message.includes("ficar indisponível"));

  await assert.rejects(() => confirmBooking({ client: {}, holdId }), { name: "TypeError" });
  console.log("Testes do serviço de disponibilidade e reservas da cliente: OK");
}

run().catch(error => {
  process.stderr.write("Falha nos testes de reservas da cliente: " + error.message + "\n");
  process.exitCode = 1;
});
