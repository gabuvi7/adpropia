import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../common/prisma/prisma.service";
import type { RequestContextService } from "../../common/request-context/request-context.service";
import { AuthService, type AuthBootstrap } from "./auth.service";

function createContextServiceMock(ctx?: { userId: string; tenantId: string; role: string }): RequestContextService {
  return {
    get: vi.fn().mockReturnValue(
      ctx ?? { userId: "user-1", tenantId: "tenant-1", role: "ADMIN", requestId: "req-1" },
    ),
    getOptional: vi.fn().mockReturnValue(ctx ?? { userId: "user-1", tenantId: "tenant-1", role: "ADMIN", requestId: "req-1" }),
    run: vi.fn(),
    fromJwtResolution: vi.fn(),
    fromTemporaryHeaders: vi.fn(),
  } as unknown as RequestContextService;
}

function createPrismaMock(tenant: { name: string } | null = { name: "Test Agency" }): PrismaService {
  return {
    tenant: {
      findUnique: vi.fn().mockResolvedValue(tenant),
    },
  } as unknown as PrismaService;
}

describe("AuthService", () => {
  it("returns bootstrap payload from request context and tenant", async () => {
    const ctxService = createContextServiceMock();
    const prisma = createPrismaMock({ name: "Mi Agencia" });
    const service = new AuthService(ctxService, prisma);

    const result: AuthBootstrap = await service.getBootstrap();

    expect(result).toEqual({
      userId: "user-1",
      tenantId: "tenant-1",
      tenantName: "Mi Agencia",
      role: "ADMIN",
    });
  });

  it("throws UnauthorizedException when no request context", async () => {
    const ctxService = createContextServiceMock();
    vi.mocked(ctxService.get).mockImplementation(() => {
      throw new Error("Missing tenant context");
    });
    const prisma = createPrismaMock();
    const service = new AuthService(ctxService, prisma);

    await expect(service.getBootstrap()).rejects.toThrow();
  });

  it("throws UnauthorizedException when tenant not found", async () => {
    const ctxService = createContextServiceMock();
    const prisma = createPrismaMock(null);
    const service = new AuthService(ctxService, prisma);

    await expect(service.getBootstrap()).rejects.toThrow(UnauthorizedException);
  });

  it("returns READONLY role from context when resolved as READONLY", async () => {
    const ctxService = createContextServiceMock({ userId: "user-2", tenantId: "tenant-2", role: "READONLY" });
    const prisma = createPrismaMock({ name: "Read Only Agency" });
    const service = new AuthService(ctxService, prisma);

    const result = await service.getBootstrap();

    expect(result).toEqual({
      userId: "user-2",
      tenantId: "tenant-2",
      tenantName: "Read Only Agency",
      role: "READONLY",
    });
  });
});
