import { ForbiddenException, Logger, type ExecutionContext } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { Reflector } from "@nestjs/core";
import type { TenantRole } from "@adpropia/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestContextService } from "../request-context/request-context.service";
import { RolesGuard, AUTH_ROLE_ENFORCEMENT_KEY } from "./roles.guard";

type ConfigServiceMock = { get: ReturnType<typeof vi.fn> };
type ReflectorMock = { getAllAndOverride: ReturnType<typeof vi.fn> };
type ContextServiceMock = { getOptional: ReturnType<typeof vi.fn> };

function createConfig(enforcement: string | undefined): ConfigServiceMock {
  return { get: vi.fn().mockReturnValue(enforcement) };
}

function createReflector(roles?: TenantRole[]): ReflectorMock {
  return { getAllAndOverride: vi.fn().mockReturnValue(roles) };
}

function createContext(userId = "desarrollo-user", role: TenantRole = "OPERATOR"): ContextServiceMock {
  return {
    getOptional: vi.fn().mockReturnValue({
      tenantId: "dev-tenant",
      userId,
      role,
      requestId: "dev-req"
    })
  };
}

function makeHandler(name: string): () => void {
  const fn = (): void => { /* noop */ };
  Object.defineProperty(fn, "name", { value: name });
  return fn;
}

function makeExecutionContext(handlerName: string): ExecutionContext {
  return {
    getHandler: () => makeHandler(handlerName),
    getClass: () => class FakeController {},
    switchToHttp: () => ({
      getRequest: () => ({ url: "/test", method: "GET" })
    })
  } as unknown as ExecutionContext;
}

function createGuard(
  reflector: ReflectorMock,
  ctx: ContextServiceMock,
  config: ConfigServiceMock
): RolesGuard {
  return new RolesGuard(
    reflector as unknown as Reflector,
    ctx as unknown as RequestContextService,
    config as unknown as ConfigService
  );
}

describe("Dev header fallback + RolesGuard integration", () => {
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

  it("dev header role READONLY permite GET en endpoint @RequiresRole(READONLY) con enforcement=true", () => {
    const config = createConfig("true");
    const reflector = createReflector(["READONLY"] as TenantRole[]);
    const ctxService = createContext("dev-user", "READONLY");
    const guard = createGuard(reflector, ctxService, config);

    const result = guard.canActivate(makeExecutionContext("list"));

    expect(result).toBe(true);
    expect(logSpy).toHaveBeenCalled();
  });

  it("dev header role OPERATOR permite POST en endpoint @RequiresRole(OPERATOR) con enforcement=true", () => {
    const config = createConfig("true");
    const reflector = createReflector(["OPERATOR"] as TenantRole[]);
    const ctxService = createContext("dev-user", "OPERATOR");
    const guard = createGuard(reflector, ctxService, config);

    const result = guard.canActivate(makeExecutionContext("create"));

    expect(result).toBe(true);
    expect(logSpy).toHaveBeenCalled();
  });

  it("dev header role READONLY NO permite POST en endpoint @RequiresRole(OPERATOR) con enforcement=true", () => {
    const config = createConfig("true");
    const reflector = createReflector(["OPERATOR"] as TenantRole[]);
    const ctxService = createContext("dev-user", "READONLY");
    const guard = createGuard(reflector, ctxService, config);

    expect(() => guard.canActivate(makeExecutionContext("create"))).toThrow(ForbiddenException);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("dev header role ADMIN satisface @RequiresRole(OPERATOR) via hierarchy con enforcement=true", () => {
    const config = createConfig("true");
    const reflector = createReflector(["OPERATOR"] as TenantRole[]);
    const ctxService = createContext("dev-user", "ADMIN");
    const guard = createGuard(reflector, ctxService, config);

    const result = guard.canActivate(makeExecutionContext("create"));

    expect(result).toBe(true);
    expect(logSpy).toHaveBeenCalled();
  });

  it("enforcement disabled + dev header insufficient role NO arroja 403 y loguea WARN", () => {
    const config = createConfig("false");
    const reflector = createReflector(["OPERATOR"] as TenantRole[]);
    const ctxService = createContext("dev-user", "READONLY");
    const guard = createGuard(reflector, ctxService, config);

    const result = guard.canActivate(makeExecutionContext("create"));

    expect(result).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
  });
});
