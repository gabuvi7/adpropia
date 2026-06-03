import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { Auth0TenantResolver, type Auth0JwtClaims } from "./auth0-tenant-resolver";

function createPrismaMock(overrides?: Partial<PrismaService>) {
  const defaultMock = {
    tenant: {
      findUnique: vi.fn()
    },
    user: {
      findUnique: vi.fn()
    },
    tenantUser: {
      findUnique: vi.fn()
    }
  } as unknown as PrismaService;

  return { ...defaultMock, ...overrides } as unknown as PrismaService;
}

const mockTenant = { id: "tenant-1", auth0OrgId: "org_abc123", name: "Test Agency", slug: "test-agency", status: "ACTIVE" as const };
const mockUser = { id: "user-1", auth0UserId: "auth0|user_xyz", email: "test@test.com", name: "Test User", isActive: true };
const mockMembership = { id: "tu-1", tenantId: "tenant-1", userId: "user-1", role: "ADMIN", isActive: true };

describe("Auth0TenantResolver", () => {
  it("resolves valid claims to internal tenant and user", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue(mockTenant as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);
    vi.mocked(prisma.tenantUser.findUnique).mockResolvedValue(mockMembership as never);

    const resolver = new Auth0TenantResolver(prisma);
    const result = await resolver.resolve({ sub: "auth0|user_xyz", org_id: "org_abc123" });

    expect(result).toEqual({
      tenantId: "tenant-1",
      userId: "user-1",
      role: "ADMIN"
    });
    expect(prisma.tenant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ auth0OrgId: "org_abc123" }) })
    );
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ auth0UserId: "auth0|user_xyz" }) })
    );
    expect(prisma.tenantUser.findUnique).toHaveBeenCalledWith({
      where: { tenantId_userId: { tenantId: "tenant-1", userId: "user-1" } }
    });
  });

  it("throws UnauthorizedException when org_id is missing", async () => {
    const resolver = new Auth0TenantResolver(createPrismaMock());
    await expect(resolver.resolve({ sub: "auth0|user_xyz" } as Auth0JwtClaims)).rejects.toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException when sub is missing", async () => {
    const resolver = new Auth0TenantResolver(createPrismaMock());
    await expect(resolver.resolve({ org_id: "org_abc123" } as Auth0JwtClaims)).rejects.toThrow(UnauthorizedException);
  });

  it("throws when tenant not found by auth0OrgId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);

    const resolver = new Auth0TenantResolver(prisma);
    await expect(resolver.resolve({ sub: "auth0|user_xyz", org_id: "org_unknown" })).rejects.toThrow(UnauthorizedException);
  });

  it("throws when tenant is not ACTIVE", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue({ ...mockTenant, status: "SUSPENDED" } as never);

    const resolver = new Auth0TenantResolver(prisma);
    await expect(resolver.resolve({ sub: "auth0|user_xyz", org_id: "org_abc123" })).rejects.toThrow(UnauthorizedException);
  });

  it("throws when user not found by auth0UserId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue(mockTenant as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);

    const resolver = new Auth0TenantResolver(prisma);
    await expect(resolver.resolve({ sub: "auth0|unknown", org_id: "org_abc123" })).rejects.toThrow(UnauthorizedException);
  });

  it("throws when user is not active", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue(mockTenant as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...mockUser, isActive: false } as never);

    const resolver = new Auth0TenantResolver(prisma);
    await expect(resolver.resolve({ sub: "auth0|user_xyz", org_id: "org_abc123" })).rejects.toThrow(UnauthorizedException);
  });

  it("throws when no membership exists for tenant+user", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue(mockTenant as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);
    vi.mocked(prisma.tenantUser.findUnique).mockResolvedValue(null as never);

    const resolver = new Auth0TenantResolver(prisma);
    await expect(resolver.resolve({ sub: "auth0|user_xyz", org_id: "org_abc123" })).rejects.toThrow(UnauthorizedException);
  });

  it("throws when membership is not active", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue(mockTenant as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);
    vi.mocked(prisma.tenantUser.findUnique).mockResolvedValue({ ...mockMembership, isActive: false } as never);

    const resolver = new Auth0TenantResolver(prisma);
    await expect(resolver.resolve({ sub: "auth0|user_xyz", org_id: "org_abc123" })).rejects.toThrow(UnauthorizedException);
  });
});
