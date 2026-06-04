import { SetMetadata } from "@nestjs/common";
import type { TenantRole } from "@adpropia/shared";

/**
 * Clave de metadata utilizada por `RolesGuard` para leer la lista de roles
 * requeridos por un handler/controller. Mantener este string estable: el guard
 * lo usa con `Reflector.getAllAndOverride`.
 */
export const REQUIRES_ROLE_KEY = "requires-role";

/**
 * Marca un endpoint (o controller entero) con la lista de roles permitidos.
 *
 * El `RolesGuard` global rechaza con `ForbiddenException` cuando
 * `AUTH_ROLE_ENFORCEMENT=true` y el rol actual no alcanza. Cuando está
 * deshabilitado, el request prosigue pero se loguea un WARN.
 *
 * @example
 *   @RequiresRole("OWNER", "ADMIN")
 *   @Patch(":id/status")
 *   async changeStatus() { ... }
 */
export const RequiresRole = (...roles: TenantRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRES_ROLE_KEY, roles);
