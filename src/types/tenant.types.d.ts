/**
 * Tipos de contexto e autorização do SaaS multitenant SALÃO PREMIUM.
 * Não são tabelas do banco; documentam contratos usados pelo front-end.
 */
export type UUID = string;
export type MembershipRole = "owner" | "admin" | "manager" | "receptionist" | "professional" | "finance" | "viewer";

export interface TenantContext {
  organizationId: UUID;
  organizationName: string;
  userId: UUID;
  role: MembershipRole;
  branchId: UUID | null;
}

export interface TenantOwnedRecord {
  id: UUID;
  org_id: UUID;
  branch_id?: UUID | null;
  created_at?: string;
  updated_at?: string;
}

export interface TenantAccessDecision {
  allowed: boolean;
  reason?: "no_session" | "no_membership" | "wrong_organization" | "role_not_allowed";
}
