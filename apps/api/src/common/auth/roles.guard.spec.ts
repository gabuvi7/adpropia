import { ForbiddenException, Logger, type ExecutionContext } from "@nestjs/common";
import { SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants";
import type { ConfigService } from "@nestjs/config";
import { ConfigService as ConfigServiceToken } from "@nestjs/config";
import type { Reflector } from "@nestjs/core";
import { Reflector as ReflectorToken } from "@nestjs/core";
import type { AuthRole } from "./auth-role";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestContextService } from "../request-context/request-context.service";
import { RequestContextService as RequestContextServiceToken } from "../request-context/request-context.service";
import { REQUIRES_ROLE_KEY } from "./roles.decorator";
import { RolesGuard, AUTH_ROLE_ENFORCEMENT_KEY } from "./roles.guard";

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
  return {
    getAllAndOverride: vi.fn()
  };
}

function createConfigServiceMock(getMock?: ReturnType<typeof vi.fn>): ConfigServiceMock {
  return {
    get: getMock ?? vi.fn()
  };
}

function createContextServiceMock(
  context?: { tenantId: string; userId: string; role: AuthRole; requestId: string }
): RequestContextMock {
  return {
    getOptional: vi.fn().mockReturnValue(context)
  };
}

function createExecutionContext(handlerName = "changeStatus"): ExecutionContext {
  const handler = function changeStatus(): void {};
  Object.defineProperty(handler, "name", { value: handlerName });

  return {
    getHandler: () => handler,
    getClass: () => class FakeController {},
    switchToHttp: () => ({
      getRequest: () => ({ url: "/liquidations/abc", method: "PATCH" })
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

describe("RolesGuard", () => {
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

  it("declares explicit injection tokens", () => {
    const dependencies = Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, RolesGuard) as Array<{
      index: number;
      param: unknown;
    }>;

    expect(dependencies).toEqual(expect.arrayContaining([
      { index: 0, param: ReflectorToken },
      { index: 1, param: RequestContextServiceToken },
      { index: 2, param: ConfigServiceToken }
    ]));
  });

  describe("enforcement=true", () => {
    let config: ConfigServiceMock;

    beforeEach(() => {
      config = createConfigServiceMock(vi.fn().mockReturnValue("true"));
    });

    it("rechaza con ForbiddenException si el handler no tiene metadata @RequiresRole (deny-by-default)", () => {
      const reflector = createReflectorMock();
      reflector.getAllAndOverride.mockReturnValue(undefined);
      const ctxService = createContextServiceMock({
        tenantId: "tenant-1", userId: "user-1", role: "READONLY", requestId: "req-1"
      });
      const guard = createGuard(reflector, ctxService, config);

      expect(() => guard.canActivate(createExecutionContext())).toThrow(ForbiddenException);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
        REQUIRES_ROLE_KEY,
        expect.any(Array)
      );
      expect(config.get).toHaveBeenCalledWith(AUTH_ROLE_ENFORCEMENT_KEY);
    });

    it("rechaza con ForbiddenException si el handler tiene metadata @RequiresRole pero el rol es insuficiente", () => {
      const reflector = createReflectorMock();
      reflector.getAllAndOverride.mockReturnValue(["OPERATOR"] as AuthRole[]);
      const ctxService = createContextServiceMock({
        tenantId: "tenant-1", userId: "user-1", role: "READONLY", requestId: "req-1"
      });
      const guard = createGuard(reflector, ctxService, config);

      expect(() => guard.canActivate(createExecutionContext())).toThrow(ForbiddenException);
      expect(warnSpy).toHaveBeenCalled();
    });

    it("permite si el handler tiene metadata @RequiresRole y el rol es suficiente (hierarchy satisfied)", () => {
      const reflector = createReflectorMock();
      reflector.getAllAndOverride.mockReturnValue(["OPERATOR"] as AuthRole[]);
      const ctxService = createContextServiceMock({
        tenantId: "tenant-1", userId: "user-1", role: "ADMIN", requestId: "req-1"
      });
      const guard = createGuard(reflector, ctxService, config);

      const result = guard.canActivate(createExecutionContext());

      expect(result).toBe(true);
      expect(logSpy).toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("rechaza con ForbiddenException si el handler tiene metadata @RequiresRole pero no hay contexto (enforcement=true)", () => {
      const reflector = createReflectorMock();
      reflector.getAllAndOverride.mockReturnValue(["OPERATOR"] as AuthRole[]);
      const ctxService = createContextServiceMock(undefined);
      const guard = createGuard(reflector, ctxService, config);

      expect(() => guard.canActivate(createExecutionContext())).toThrow(ForbiddenException);
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe("enforcement=false", () => {
    let config: ConfigServiceMock;

    beforeEach(() => {
      config = createConfigServiceMock(vi.fn().mockReturnValue("false"));
    });

    it("permite y loguea WARN si el handler no tiene metadata @RequiresRole (enforcement disabled)", () => {
      const reflector = createReflectorMock();
      reflector.getAllAndOverride.mockReturnValue(undefined);
      const ctxService = createContextServiceMock({
        tenantId: "tenant-1", userId: "user-1", role: "READONLY", requestId: "req-1"
      });
      const guard = createGuard(reflector, ctxService, config);

      const result = guard.canActivate(createExecutionContext());

      expect(result).toBe(true);
      expect(warnSpy).toHaveBeenCalled();
      const payload = warnSpy.mock.calls[0]?.[0];
      expect(payload).toEqual(
        expect.objectContaining({
          enforcement: false,
          expectedRoles: [],
          actualRole: "READONLY"
        })
      );
    });

    it("permite pero loguea WARN si tiene metadata pero el rol es insuficiente", () => {
      const reflector = createReflectorMock();
      reflector.getAllAndOverride.mockReturnValue(["OWNER", "ADMIN"] as AuthRole[]);
      const ctxService = createContextServiceMock({
        tenantId: "tenant-1", userId: "user-1", role: "OPERATOR", requestId: "req-1"
      });
      const guard = createGuard(reflector, ctxService, config);

      const result = guard.canActivate(createExecutionContext("transitionToPaid"));

      expect(result).toBe(true);
      expect(warnSpy).toHaveBeenCalled();
      const payload = warnSpy.mock.calls[0]?.[0];
      expect(payload).toEqual(
        expect.objectContaining({
          enforcement: false,
          expectedRoles: ["OWNER", "ADMIN"],
          actualRole: "OPERATOR"
        })
      );
    });
  });

  describe("SUPERADMIN hierarchy (global platform role)", () => {
    let config: ConfigServiceMock;

    beforeEach(() => {
      config = createConfigServiceMock(vi.fn().mockReturnValue("true"));
    });

    it("SUPERADMIN passes @RequiresRole(OWNER) via hierarchy", () => {
      const reflector = createReflectorMock();
      reflector.getAllAndOverride.mockReturnValue(["OWNER"] as AuthRole[]);
      const ctxService = createContextServiceMock({
        tenantId: "tenant-1", userId: "user-super", role: "SUPERADMIN", requestId: "req-1"
      });
      const guard = createGuard(reflector, ctxService, config);

      const result = guard.canActivate(createExecutionContext());
      expect(result).toBe(true);
      expect(logSpy).toHaveBeenCalled();
    });

    it("SUPERADMIN passes @RequiresRole(SUPERADMIN) explicitly", () => {
      const reflector = createReflectorMock();
      reflector.getAllAndOverride.mockReturnValue(["SUPERADMIN"] as AuthRole[]);
      const ctxService = createContextServiceMock({
        tenantId: "tenant-1", userId: "user-super", role: "SUPERADMIN", requestId: "req-1"
      });
      const guard = createGuard(reflector, ctxService, config);

      const result = guard.canActivate(createExecutionContext());
      expect(result).toBe(true);
      expect(logSpy).toHaveBeenCalled();
    });

    it("OWNER fails @RequiresRole(SUPERADMIN) — hierarchy denied", () => {
      const reflector = createReflectorMock();
      reflector.getAllAndOverride.mockReturnValue(["SUPERADMIN"] as AuthRole[]);
      const ctxService = createContextServiceMock({
        tenantId: "tenant-1", userId: "user-owner", role: "OWNER", requestId: "req-1"
      });
      const guard = createGuard(reflector, ctxService, config);

      expect(() => guard.canActivate(createExecutionContext())).toThrow(ForbiddenException);
      expect(warnSpy).toHaveBeenCalled();
    });

    it("ADMIN fails @RequiresRole(SUPERADMIN)", () => {
      const reflector = createReflectorMock();
      reflector.getAllAndOverride.mockReturnValue(["SUPERADMIN"] as AuthRole[]);
      const ctxService = createContextServiceMock({
        tenantId: "tenant-1", userId: "user-admin", role: "ADMIN", requestId: "req-1"
      });
      const guard = createGuard(reflector, ctxService, config);

      expect(() => guard.canActivate(createExecutionContext())).toThrow(ForbiddenException);
      expect(warnSpy).toHaveBeenCalled();
    });

    it("OPERATOR fails @RequiresRole(SUPERADMIN)", () => {
      const reflector = createReflectorMock();
      reflector.getAllAndOverride.mockReturnValue(["SUPERADMIN"] as AuthRole[]);
      const ctxService = createContextServiceMock({
        tenantId: "tenant-1", userId: "user-op", role: "OPERATOR", requestId: "req-1"
      });
      const guard = createGuard(reflector, ctxService, config);

      expect(() => guard.canActivate(createExecutionContext())).toThrow(ForbiddenException);
      expect(warnSpy).toHaveBeenCalled();
    });

    it("READONLY fails @RequiresRole(SUPERADMIN)", () => {
      const reflector = createReflectorMock();
      reflector.getAllAndOverride.mockReturnValue(["SUPERADMIN"] as AuthRole[]);
      const ctxService = createContextServiceMock({
        tenantId: "tenant-1", userId: "user-ro", role: "READONLY", requestId: "req-1"
      });
      const guard = createGuard(reflector, ctxService, config);

      expect(() => guard.canActivate(createExecutionContext())).toThrow(ForbiddenException);
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe("enforcement=true (default — unset config)", () => {
    let config: ConfigServiceMock;

    beforeEach(() => {
      config = createConfigServiceMock(vi.fn().mockReturnValue(undefined));
    });

    it("rechaza con ForbiddenException si el rol es insuficiente (default true)", () => {
      const reflector = createReflectorMock();
      reflector.getAllAndOverride.mockReturnValue(["OPERATOR"] as AuthRole[]);
      const ctxService = createContextServiceMock({
        tenantId: "tenant-1", userId: "user-1", role: "READONLY", requestId: "req-1"
      });
      const guard = createGuard(reflector, ctxService, config);

      expect(() => guard.canActivate(createExecutionContext())).toThrow(ForbiddenException);
    });
  });

  describe("legacy behavior (enforcement=false hardcoded, no mock config)", () => {
    let config: ConfigServiceMock;

    beforeEach(() => {
      config = createConfigServiceMock(vi.fn().mockReturnValue("false"));
    });

    it("permite si el handler no tiene metadata @RequiresRole", () => {
      const reflector = createReflectorMock();
      reflector.getAllAndOverride.mockReturnValue(undefined);
      const ctxService = createContextServiceMock();
      const guard = createGuard(reflector, ctxService, config);

      const result = guard.canActivate(createExecutionContext());

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
        REQUIRES_ROLE_KEY,
        expect.any(Array)
      );
    });

    it("permite y loguea WARN si tiene metadata pero el contexto no tiene rol disponible", () => {
      const reflector = createReflectorMock();
      reflector.getAllAndOverride.mockReturnValue(["ADMIN"] as AuthRole[]);
      const ctxService = createContextServiceMock(undefined);
      const guard = createGuard(reflector, ctxService, config);

      const result = guard.canActivate(createExecutionContext());

      expect(result).toBe(true);
      expect(warnSpy).toHaveBeenCalled();
      const payload = warnSpy.mock.calls[0]?.[0];
      expect(payload).toEqual(
        expect.objectContaining({
          enforcement: false,
          expectedRoles: ["ADMIN"],
          actualRole: undefined
        })
      );
    });

    it("permite pero loguea WARN si el rol del contexto NO está en la lista permitida", () => {
      const reflector = createReflectorMock();
      reflector.getAllAndOverride.mockReturnValue(["OWNER", "ADMIN"] as AuthRole[]);
      const ctxService = createContextServiceMock({
        tenantId: "tenant-1",
        userId: "user-1",
        role: "OPERATOR",
        requestId: "req-1"
      });
      const guard = createGuard(reflector, ctxService, config);

      const result = guard.canActivate(createExecutionContext("transitionToPaid"));

      expect(result).toBe(true);
      expect(warnSpy).toHaveBeenCalled();
      const payload = warnSpy.mock.calls[0]?.[0];
      expect(payload).toEqual(
        expect.objectContaining({
          enforcement: false,
          expectedRoles: ["OWNER", "ADMIN"],
          actualRole: "OPERATOR",
          tenantId: "tenant-1",
          userId: "user-1",
          requestId: "req-1",
          endpoint: "transitionToPaid"
        })
      );
    });

    it("permite y loguea INFO si el rol del contexto SÍ está en la lista", () => {
      const reflector = createReflectorMock();
      reflector.getAllAndOverride.mockReturnValue(["OWNER", "ADMIN"] as AuthRole[]);
      const ctxService = createContextServiceMock({
        tenantId: "tenant-1",
        userId: "user-1",
        role: "ADMIN",
        requestId: "req-1"
      });
      const guard = createGuard(reflector, ctxService, config);

      const result = guard.canActivate(createExecutionContext());

      expect(result).toBe(true);
      expect(warnSpy).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalled();
      const payload = logSpy.mock.calls[0]?.[0];
      expect(payload).toEqual(
        expect.objectContaining({
          enforcement: false,
          expectedRoles: ["OWNER", "ADMIN"],
          actualRole: "ADMIN"
        })
      );
    });
  });
});
