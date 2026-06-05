import { type ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { TenantRole } from "@adpropia/shared";
import type { RequestContextService } from "../request-context/request-context.service";
import { Auth0Guard } from "./auth0.guard";

function createContextServiceMock(context?: { tenantId: string; userId: string; role: TenantRole | string; requestId: string }): RequestContextService {
  return {
    getOptional: vi.fn().mockReturnValue(context)
  } as unknown as RequestContextService;
}

function createExecutionContext(): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ url: "/test", method: "GET" })
    }),
    getHandler: () => (() => {}),
    getClass: () => class FakeController {}
  } as unknown as ExecutionContext;
}

describe("Auth0Guard", () => {
  it("allows when request context is present", () => {
    const ctxService = createContextServiceMock({
      tenantId: "tenant-1",
      userId: "user-1",
      role: "ADMIN",
      requestId: "req-1"
    });
    const guard = new Auth0Guard(ctxService);

    expect(guard.canActivate(createExecutionContext())).toBe(true);
  });

  it("allows SUPERADMIN platform contexts created from global Auth0 claims", () => {
    const ctxService = createContextServiceMock({
      tenantId: "platform",
      userId: "user-1",
      role: "SUPERADMIN",
      requestId: "req-1"
    });
    const guard = new Auth0Guard(ctxService);

    expect(guard.canActivate(createExecutionContext())).toBe(true);
  });

  it("rejects with UnauthorizedException when no request context", () => {
    const ctxService = createContextServiceMock(undefined);
    const guard = new Auth0Guard(ctxService);

    expect(() => guard.canActivate(createExecutionContext())).toThrow(UnauthorizedException);
  });

  it("allows SUPERADMIN request context", () => {
    const ctxService = createContextServiceMock({
      tenantId: "tenant-1",
      userId: "user-super",
      role: "SUPERADMIN",
      requestId: "req-1"
    });
    const guard = new Auth0Guard(ctxService);

    expect(guard.canActivate(createExecutionContext())).toBe(true);
  });
});
