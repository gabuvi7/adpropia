import type { TenantRole } from "@adpropia/shared";

const roleRank: Record<TenantRole, number> = {
  READONLY: 0,
  OPERATOR: 1,
  ADMIN: 2,
  OWNER: 3
};

export function hasMinimumRole(currentRole: TenantRole, minimumRole: TenantRole): boolean {
  return roleRank[currentRole] >= roleRank[minimumRole];
}

export function assertMinimumRole(currentRole: TenantRole, minimumRole: TenantRole): void {
  if (!hasMinimumRole(currentRole, minimumRole)) {
    throw new Error(`Role ${currentRole} cannot perform action requiring ${minimumRole}`);
  }
}

/** Roles disponibles, ordenados de mayor privilegio a menor. */
export const ALL_ROLES: readonly TenantRole[] = ["OWNER", "ADMIN", "OPERATOR", "READONLY"] as const;

/** Permisos compartidos para módulos de entidades core (propietarios, inquilinos, propiedades, contratos). */
export const CORE_ENTITY_PERMISSIONS = {
  list: ["READONLY"] as const,
  read: ["READONLY"] as const,
  create: ["OPERATOR"] as const,
  update: ["OPERATOR"] as const
} as const satisfies Record<string, ReadonlyArray<TenantRole>>;

/** Permisos compartidos para el módulo de pagos. */
export const PAYMENTS_PERMISSIONS = {
  list: ["READONLY"] as const,
  read: ["READONLY"] as const,
  balance: ["READONLY"] as const,
  create: ["OPERATOR"] as const
} as const satisfies Record<string, ReadonlyArray<TenantRole>>;

/** Permisos compartidos para cash-movements. */
export const CASH_MOVEMENTS_PERMISSIONS = {
  list: ["READONLY"] as const
} as const satisfies Record<string, ReadonlyArray<TenantRole>>;

/** Permisos compartidos para reportes. */
export const REPORTS_PERMISSIONS = {
  renterHistory: ["READONLY"] as const,
  upcomingDuePayments: ["READONLY"] as const,
  cashFlow: ["READONLY"] as const,
  outstandingBalances: ["READONLY"] as const
} as const satisfies Record<string, ReadonlyArray<TenantRole>>;

/** Permisos compartidos para tenants (administración). */
export const TENANTS_PERMISSIONS = {
  list: ["ADMIN"] as const,
  read: ["ADMIN"] as const,
  create: ["OWNER"] as const
} as const satisfies Record<string, ReadonlyArray<TenantRole>>;

/** Permisos compartidos para admin/provisioning endpoints (OWNER-only). */
export const ADMIN_PROVISIONING_PERMISSIONS = {
  manage: ["OWNER"] as const
} as const satisfies Record<string, ReadonlyArray<TenantRole>>;

/**
 * Matriz declarativa de permisos para Liquidaciones (US-025/US-026, REQ-013).
 *
 * Cada acción declara la lista de roles permitidos. El `RolesGuard` consume
 * esta matriz vía el decorador `@RequiresRole(...)` colocando metadata por
 * handler. En esta iteración el enforcement está apagado (placeholder
 * pasivo): el guard sólo loguea cuando un rol no alcanzaría.
 *
 * Esta matriz refleja la decisión aprobada en proposal/spec REQ-013.
 * El enforcement real se activa con US-007.
 */
export const LIQUIDATIONS_PERMISSIONS = {
  list: ALL_ROLES,
  read: ALL_ROLES,
  download: ALL_ROLES,
  preview: ["OWNER", "ADMIN", "OPERATOR"],
  create: ["OWNER", "ADMIN", "OPERATOR"],
  updateDraft: ["OWNER", "ADMIN", "OPERATOR"],
  transitionToIssued: ["OWNER", "ADMIN", "OPERATOR"],
  transitionToPaid: ["OWNER", "ADMIN"],
  transitionToVoided: ["OWNER", "ADMIN"],
  /**
   * Permiso del endpoint `PATCH /liquidations/:id/status`. El endpoint cubre
   * transiciones a ISSUED, PAID y VOIDED — la unión de los permisos
   * (OWNER, ADMIN, OPERATOR). El service valida internamente la transición y
   * el rol mínimo real (OPERATOR puede emitir, ADMIN/OWNER pueden marcar PAID
   * o VOIDED). Cuando US-007 active enforcement granular, se reemplaza por
   * un guard que mire el `body.status`.
   */
  changeStatus: ["OWNER", "ADMIN", "OPERATOR"],
  manualAdjustments: ["OWNER", "ADMIN"]
} as const satisfies Record<string, ReadonlyArray<TenantRole>>;
