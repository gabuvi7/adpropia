import { ForbiddenException, Logger, type ExecutionContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Reflector } from "@nestjs/core";
import type { TenantRole } from "@adpropia/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestContextService } from "../request-context/request-context.service";
import { REQUIRES_ROLE_KEY } from "./roles.decorator";
import { AUTH_ROLE_ENFORCEMENT_KEY, RolesGuard } from "./roles.guard";

type ReflectorMock = {
  getAllAndOverride: ReturnType<typeof vi.fn>;
};

type RequestContextMock = {
  getOptional: ReturnType<typeof vi.fn>;
};

type ConfigServiceMock = {
  get: ReturnType<typeof vi.fn>;
};

function createReflectorMock(): ReflectorMock {
  return { getAllAndOverride: vi.fn() };
}

function createConfigServiceMock(getMock?: ReturnType<typeof vi.fn>): ConfigServiceMock {
  return { get: getMock ?? vi.fn() };
}

function createContextServiceMock(
  context?: { tenantId: string; userId: string; role: TenantRole; requestId: string }
): RequestContextMock {
  return { getOptional: vi.fn().mockReturnValue(context) };
}

function createExecutionContext(handlerName = "list"): ExecutionContext {
  const handler = function list(): void {};
  Object.defineProperty(handler, "name", { value: handlerName });

  return {
    getHandler: () => handler,
    getClass: () => class FakeController {},
    switchToHttp: () => ({
      getRequest: () => ({ url: "/owners", method: "GET" })
    })
  } as unknown as ExecutionContext;
}

function createGuard(
  reflector: ReflectorMock,
  ctx: RequestContextMock,
  config: ConfigServiceMock
): RolesGuard {
  return new RolesGuard(
    reflector as unknown as Reflector,
    ctx as unknown as RequestContextService,
    config as unknown as ConfigService
  );
}

describe("Dev header fallback compatibility", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    logSpy = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("dev header role READONLY passes READONLY-endpoint with enforcement enabled", () => {
    const reflector = createReflectorMock();
    reflector.getAllAndOverride.mockReturnValue(["READONLY"] as TenantRole[]);
    const ctxService = createContextServiceMock({
      tenantId: "dev-tenant",
      userId: "dev-user",
      role: "READONLY",
      requestId: "dev-req"
    });
    const config = createConfigServiceMock(vi.fn().mockReturnValue("true"));
    const guard = createGuard(reflector, ctxService, config);

    const result = guard.canActivate(createExecutionContext("list"));

    expect(result).toBe(true);
    expect(logSpy).toHaveBeenCalled();
    expect(config.get).toHaveBeenCalledWith(AUTH_ROLE_ENFORCEMENT_KEY);
  });

  it("dev header role ADMIN passes OPERATOR-endpoint with enforcement enabled (hierarchy)", () => {
    const reflector = createReflectorMock();
    reflector.getAllAndOverride.mockReturnValue(["OPERATOR"] as TenantRole[]);
    const ctxService = createContextServiceMock({
      tenantId: "dev-tenant",
      userId: "dev-user",
      role: "ADMIN",
      requestId: "dev-req"
    });
    const config = createConfigServiceMock(vi.fn().mockReturnValue("true"));
    const guard = createGuard(reflector, ctxService, config);

    const result = guard.canActivate(createExecutionContext("create"));

    expect(result).toBe(true);
    expect(logSpy).toHaveBeenCalled();
  });

  it("dev header role OPERATOR is rejected for ADMIN-endpoint with enforcement enabled", () => {
    const reflector = createReflectorMock();
    reflector.getAllAndOverride.mockReturnValue(["ADMIN"] as TenantRole[]);
    const ctxService = createContextServiceMock({
      tenantId: "dev-tenant",
      userId: "dev-user",
      role: "OPERATOR",
      requestId: "dev-req"
    });
    const config = createConfigServiceMock(vi.fn().mockReturnValue("true"));
    const guard = createGuard(reflector, ctxService, config);

    expect(() => guard.canActivate(createExecutionContext("changeStatus"))).toThrow(ForbiddenException);
    expect(warnSpy).toHaveBeenCalled();
  });
});
