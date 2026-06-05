import type { TenantRole } from "@adpropia/shared";

export const PLATFORM_ROLE_SUPERADMIN = "SUPERADMIN" as const;

export type PlatformRole = typeof PLATFORM_ROLE_SUPERADMIN;
export type AuthRole = TenantRole | PlatformRole;

export const authRoles = [
  PLATFORM_ROLE_SUPERADMIN,
  "OWNER",
  "ADMIN",
  "OPERATOR",
  "READONLY"
] as const satisfies readonly AuthRole[];

export const tenantAuthRoles = ["OWNER", "ADMIN", "OPERATOR", "READONLY"] as const satisfies readonly TenantRole[];

export function normalizeAuthRole(value: string): AuthRole | undefined {
  const normalized = value.trim().toUpperCase();
  return authRoles.includes(normalized as AuthRole) ? (normalized as AuthRole) : undefined;
}

export function isTenantRole(role: AuthRole): role is TenantRole {
  return tenantAuthRoles.includes(role as TenantRole);
}
