/**
 * Módulo: couponService.js
 * Responsabilidade: validar formato de código e expor operações de cupom.
 * Desconto, limite de uso e validade sempre serão confirmados no backend.
 */
export function normalizeCouponCode(value) {
  const code = String(value ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) throw new Error("Digite um código promocional válido.");
  return code;
}
function notReady() {
  const error = new Error("Os cupons estarão disponíveis após a implantação do serviço seguro de promoções.");
  error.code = "COUPON_SERVICE_NOT_READY";
  return error;
}
export async function listCustomerCoupons() { throw notReady(); }
export async function redeemCoupon() { throw notReady(); }
export async function validateCouponForBooking() { throw notReady(); }
