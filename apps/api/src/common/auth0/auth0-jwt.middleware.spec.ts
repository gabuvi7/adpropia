import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants";
import { describe, expect, it, vi } from "vitest";
import { Auth0TenantResolver, type Auth0JwtClaims } from "./auth0-tenant-resolver";
import { Auth0JwtMiddleware } from "./auth0-jwt.middleware";
import type { Auth0JwtService } from "./auth0-jwt.service";
import { Auth0JwtService as Auth0JwtServiceToken } from "./auth0-jwt.service";
import type { RequestContextService } from "../request-context/request-context.service";
import { RequestContextService as RequestContextServiceToken } from "../request-context/request-context.service";

function createJwtServiceMock(claims?: Auth0JwtClaims): Auth0JwtService {
  return {
    verifyAndDecode: vi.fn().mockResolvedValue(
      claims ?? { sub: "auth0|user_xyz", org_id: "org_abc123", jti: "jti-123" }
    )
  } as unknown as Auth0JwtService;
}

function createJwtServiceErrorMock(): Auth0JwtService {
  return {
    verifyAndDecode: vi.fn().mockRejectedValue(new Error("Invalid token"))
  } as unknown as Auth0JwtService;
}

function createContextServiceMock(): RequestContextService {
  return {
    run: vi.fn((_ctx, cb) => cb()),
    fromJwtResolution: vi.fn((resolution, requestId) => ({
      requestId,
      userId: resolution.userId,
      tenantId: resolution.tenantId,
      role: resolution.role
    })),
    getOptional: vi.fn().mockReturnValue(undefined)
  } as unknown as RequestContextService;
}

function createTenantResolverMock(shouldReject = false): Auth0TenantResolver {
  return {
    resolve: vi.fn().mockImplementation(shouldReject
      ? () => Promise.reject(new ForbiddenException("No access"))
      : () => Promise.resolve({ tenantId: "tenant-1", userId: "user-1", role: "ADMIN" })
    )
  } as unknown as Auth0TenantResolver;
}

function createRequest(authHeader?: string): { headers: Record<string, string | string[] | undefined> } {
  return { headers: { ...(authHeader ? { authorization: authHeader } : {}) } };
}

describe("Auth0JwtMiddleware", () => {
  it("declares explicit injection tokens for Nest middleware DI", () => {
    const dependencies = Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, Auth0JwtMiddleware) as Array<{
      index: number;
      param: unknown;
    }>;

    expect(dependencies).toEqual(expect.arrayContaining([
      { index: 0, param: Auth0JwtServiceToken },
      { index: 1, param: RequestContextServiceToken },
      { index: 2, param: Auth0TenantResolver }
    ]));
  });

  it("validates JWT and resolves tenant, populates context", async () => {
    const jwtService = createJwtServiceMock();
    const ctxService = createContextServiceMock();
    const resolver = createTenantResolverMock();
    const middleware = new Auth0JwtMiddleware(jwtService, ctxService, resolver);

    const req = createRequest("Bearer test-token");
    const next = vi.fn();

    await middleware.use(req, undefined, next);

    expect(jwtService.verifyAndDecode).toHaveBeenCalledWith("test-token");
    expect(resolver.resolve).toHaveBeenCalledWith(
      expect.objectContaining({ sub: "auth0|user_xyz", org_id: "org_abc123" })
    );
    expect(ctxService.run).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        tenantId: "tenant-1",
        role: "ADMIN",
        requestId: "jti-123"
      }),
      expect.any(Function)
    );
    expect(next).toHaveBeenCalled();
  });

  it("calls next() without context when no Bearer token and not production", async () => {
    const jwtService = createJwtServiceMock();
    const ctxService = createContextServiceMock();
    const resolver = createTenantResolverMock();
    const middleware = new Auth0JwtMiddleware(jwtService, ctxService, resolver);

    const req = createRequest();
    const next = vi.fn();

    await middleware.use(req, undefined, next);

    expect(ctxService.run).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it("throws UnauthorizedException when no Bearer token in production", async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const jwtService = createJwtServiceMock();
    const ctxService = createContextServiceMock();
    const resolver = createTenantResolverMock();
    const middleware = new Auth0JwtMiddleware(jwtService, ctxService, resolver);

    const req = createRequest();

    await expect(middleware.use(req, undefined, vi.fn())).rejects.toThrow(UnauthorizedException);

    process.env.NODE_ENV = origEnv;
  });

  it("throws when JWT verification fails", async () => {
    const jwtService = createJwtServiceErrorMock();
    const ctxService = createContextServiceMock();
    const resolver = createTenantResolverMock();
    const middleware = new Auth0JwtMiddleware(jwtService, ctxService, resolver);

    const req = createRequest("Bearer bad-token");

    await expect(middleware.use(req, undefined, vi.fn())).rejects.toThrow(UnauthorizedException);
  });

  it("keeps safe JWT verification failure details in non-production", async () => {
    const jwtService = createJwtServiceErrorMock();
    const ctxService = createContextServiceMock();
    const resolver = createTenantResolverMock();
    const middleware = new Auth0JwtMiddleware(jwtService, ctxService, resolver);

    const req = createRequest("Bearer bad-token");

    await expect(middleware.use(req, undefined, vi.fn())).rejects.toThrow("Token invalido. Detalle: Invalid token");
  });

  it("throws ForbiddenException when tenant resolution denies an authenticated identity", async () => {
    const jwtService = createJwtServiceMock();
    const ctxService = createContextServiceMock();
    const resolver = createTenantResolverMock(true);
    const middleware = new Auth0JwtMiddleware(jwtService, ctxService, resolver);

    const req = createRequest("Bearer test-token");

    await expect(middleware.use(req, undefined, vi.fn())).rejects.toThrow(ForbiddenException);
  });
});
