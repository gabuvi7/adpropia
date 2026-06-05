import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { normalizeAuthRole, PLATFORM_ROLE_SUPERADMIN, type AuthRole } from "../auth/auth-role";
import type { RequestContext } from "./request-context";

type HeaderValue = string | string[] | undefined;
type RequestHeaders = Record<string, HeaderValue>;

export type JwtResolution = {
  userId: string;
  tenantId: string;
  role: AuthRole;
};

function firstHeader(value: HeaderValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function requiredHeader(headers: RequestHeaders, name: string, label: string): string {
  const value = firstHeader(headers[name]);
  if (!value?.trim()) {
    throw new InvalidRequestContextError(`Falta el header temporal ${label}.`);
  }

  return value.trim();
}

export class MissingTenantContextError extends Error {
  constructor() {
    super("Falta el tenant activo en el contexto de la solicitud.");
  }
}

export class InvalidRequestContextError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  run<T>(context: RequestContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  get(): RequestContext {
    const context = this.storage.getStore();
    if (!context?.tenantId) {
      throw new MissingTenantContextError();
    }

    return context;
  }

  getOptional(): RequestContext | undefined {
    return this.storage.getStore();
  }

  /**
   * Construye contexto desde la resolucion JWT de Auth0.
   * Usado por Auth0JwtMiddleware para poblar el contexto.
   */
  fromJwtResolution(resolution: JwtResolution, requestId: string): RequestContext {
    return {
      requestId,
      userId: resolution.userId,
      tenantId: resolution.tenantId,
      role: resolution.role
    };
  }

  /**
   * Puente TEMPORAL para desarrollo/testing: construye contexto desde headers.
   * Debe reemplazarse por JWT auth antes de producción real.
   */
  fromTemporaryHeaders(headers: RequestHeaders): RequestContext {
    if (process.env.NODE_ENV === "production") {
      throw new InvalidRequestContextError("El contexto temporal por headers no está habilitado en producción.");
    }

    const role = normalizeAuthRole(firstHeader(headers["x-role"]) ?? "OPERATOR");
    if (!role) {
      throw new InvalidRequestContextError("El rol temporal enviado no es válido.");
    }

    const tenantId = role === PLATFORM_ROLE_SUPERADMIN
      ? firstHeader(headers["x-tenant-id"])?.trim() || "platform"
      : requiredHeader(headers, "x-tenant-id", "x-tenant-id");

    return {
      tenantId,
      userId: firstHeader(headers["x-user-id"])?.trim() || "usuario-desarrollo",
      role,
      requestId: firstHeader(headers["x-request-id"])?.trim() || randomUUID()
    };
  }
}
