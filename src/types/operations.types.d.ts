/**
 * Contratos de dados dos fluxos operacionais.
 * Valores monetários são números em BRL; datas persistidas são ISO-8601.
 */
import type { UUID, TenantOwnedRecord } from "./tenant.types";

export type AppointmentStatus = "scheduled" | "confirmed" | "arrived" | "in_progress" | "completed" | "cancelled" | "no_show";
export type ServiceOrderStatus = "open" | "in_progress" | "awaiting_payment" | "partially_paid" | "closed" | "cancelled";
export type PaymentStatus = "confirmed" | "refunded" | "cancelled";
export type CashRegisterStatus = "open" | "closed";
export type QuoteStatus = "draft" | "pending" | "accepted" | "rejected" | "expired" | "cancelled";

export interface AppointmentRecord extends TenantOwnedRecord {
  customer_id: UUID;
  professional_id: UUID;
  service_id: UUID;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  appointment_group_id?: UUID | null;
  service_order_id?: UUID | null;
}

export interface ServiceOrderRecord extends TenantOwnedRecord {
  order_number: number;
  customer_id: UUID | null;
  status: ServiceOrderStatus;
  subtotal: number;
  discount: number;
  total: number;
  assigned_professional_id?: UUID | null;
}

export interface ServiceOrderItemRecord extends TenantOwnedRecord {
  order_id: UUID;
  item_type: "service" | "product";
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
  professional_id: UUID | null;
}

export interface ServiceOrderPaymentRecord extends TenantOwnedRecord {
  order_id: UUID;
  amount: number;
  payment_method: "pix" | "cash" | "credit_card" | "debit_card" | "transfer" | "voucher" | "other";
  status: PaymentStatus;
  cash_movement_id: UUID | null;
  refunded_at?: string | null;
  refund_cash_movement_id?: UUID | null;
}

export interface CashRegisterRecord extends TenantOwnedRecord {
  status: CashRegisterStatus;
  opening_amount: number;
  expected_amount?: number;
  closing_amount?: number | null;
  opened_at: string;
  closed_at?: string | null;
}

export interface QuoteRecord extends TenantOwnedRecord {
  quote_number: number;
  customer_id: UUID;
  status: QuoteStatus;
  subtotal: number;
  discount_total: number;
  total: number;
  valid_until?: string | null;
}
