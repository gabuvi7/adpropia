import { ForbiddenException, UnauthorizedException, Logger } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import {
  Auth0TenantResolver,
  AUTH0_PLATFORM_ROLES_CLAIM,
  type Auth0JwtClaims
} from "./auth0-tenant-resolver";

function createPrismaMock(overrides?: Partial<PrismaService>) {
  const defaultMock = {
    tenant: {
      findUnique: vi.fn()
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn()
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

  it("throws ForbiddenException when tenant not found by auth0OrgId and does not create tenant", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);

    const resolver = new Auth0TenantResolver(prisma);
    await expect(resolver.resolve({ sub: "auth0|user_xyz", org_id: "org_unknown" })).rejects.toThrow(ForbiddenException);
    expect(prisma.tenant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ auth0OrgId: "org_unknown" }) })
    );
    expect("create" in prisma.tenant ? prisma.tenant.create : undefined).toBeUndefined();
  });

  it("throws ForbiddenException when tenant is not ACTIVE", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue({ ...mockTenant, status: "SUSPENDED" } as never);

    const resolver = new Auth0TenantResolver(prisma);
    await expect(resolver.resolve({ sub: "auth0|user_xyz", org_id: "org_abc123" })).rejects.toThrow(ForbiddenException);
  });

  it("auto-creates a missing active user from safe Auth0 claims but denies access without membership", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue(mockTenant as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.user.create).mockResolvedValue({
      ...mockUser,
      id: "user-created",
      auth0UserId: "auth0|new_user",
      email: "new.user@example.com",
      name: "New User",
      isActive: true
    } as never);
    vi.mocked(prisma.tenantUser.findUnique).mockResolvedValue(null as never);

    const resolver = new Auth0TenantResolver(prisma);
    await expect(resolver.resolve({
      sub: "auth0|new_user",
      org_id: "org_abc123",
      email: "new.user@example.com",
      name: "New User"
    })).rejects.toThrow(ForbiddenException);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        auth0UserId: "auth0|new_user",
        email: "new.user@example.com",
        name: "New User",
        isActive: true
      }
    });
    expect(prisma.tenantUser.findUnique).toHaveBeenCalledWith({
      where: { tenantId_userId: { tenantId: "tenant-1", userId: "user-created" } }
    });
  });

  it("throws ForbiddenException when user is not active", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue(mockTenant as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...mockUser, isActive: false } as never);

    const resolver = new Auth0TenantResolver(prisma);
    await expect(resolver.resolve({ sub: "auth0|user_xyz", org_id: "org_abc123" })).rejects.toThrow(ForbiddenException);
  });

  it("throws ForbiddenException when no membership exists for tenant+user", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue(mockTenant as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);
    vi.mocked(prisma.tenantUser.findUnique).mockResolvedValue(null as never);

    const resolver = new Auth0TenantResolver(prisma);
    await expect(resolver.resolve({ sub: "auth0|user_xyz", org_id: "org_abc123" })).rejects.toThrow(ForbiddenException);
  });

  it("throws ForbiddenException when membership is not active", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue(mockTenant as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);
    vi.mocked(prisma.tenantUser.findUnique).mockResolvedValue({ ...mockMembership, isActive: false } as never);

    const resolver = new Auth0TenantResolver(prisma);
    await expect(resolver.resolve({ sub: "auth0|user_xyz", org_id: "org_abc123" })).rejects.toThrow(ForbiddenException);
  });

  it("uses TenantUser.role as the local authorization source", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue(mockTenant as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);
    vi.mocked(prisma.tenantUser.findUnique).mockResolvedValue({ ...mockMembership, role: "READONLY" } as never);

    const resolver = new Auth0TenantResolver(prisma);
    const result = await resolver.resolve({ sub: "auth0|user_xyz", org_id: "org_abc123", "https://adpropia.com/roles": ["ADMIN"] });

    expect(result.role).toBe("READONLY");
  });

  describe("SUPERADMIN claim resolution", () => {
    it("returns SUPERADMIN role when claims have superadmin flag", async () => {
      const prisma = createPrismaMock();
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(mockTenant as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);
      vi.mocked(prisma.tenantUser.findUnique).mockResolvedValue(mockMembership as never);
      const resolver = new Auth0TenantResolver(prisma);

      const result = await resolver.resolve({
        sub: "auth0|user_xyz",
        org_id: "org_abc123",
        "https://adpropia.app/superadmin": true
      });

      expect(result.role).toBe("SUPERADMIN");
      expect(result.tenantId).toBe("tenant-1");
      expect(result.userId).toBe("user-1");
    });

    it("returns SUPERADMIN role when platform roles claim contains SUPERADMIN", async () => {
      const prisma = createPrismaMock();
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(mockTenant as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);
      const resolver = new Auth0TenantResolver(prisma);

      const result = await resolver.resolve({
        sub: "auth0|user_xyz",
        org_id: "org_abc123",
        [AUTH0_PLATFORM_ROLES_CLAIM]: ["SUPPORT", "SUPERADMIN"]
      });

      expect(result).toEqual({
        tenantId: "tenant-1",
        userId: "user-1",
        role: "SUPERADMIN"
      });
      expect(prisma.tenantUser.findUnique).not.toHaveBeenCalled();
    });

    it("resolves platform context when platform roles SUPERADMIN claim has no org_id", async () => {
      const prisma = createPrismaMock();
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);
      const resolver = new Auth0TenantResolver(prisma);

      const result = await resolver.resolve({
        sub: "auth0|user_xyz",
        [AUTH0_PLATFORM_ROLES_CLAIM]: ["SUPERADMIN"]
      });

      expect(result).toEqual({
        tenantId: "platform",
        userId: "user-1",
        role: "SUPERADMIN"
      });
      expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
      expect(prisma.tenantUser.findUnique).not.toHaveBeenCalled();
    });

    it("falls through to membership role when superadmin flag is false", async () => {
      const prisma = createPrismaMock();
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(mockTenant as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);
      vi.mocked(prisma.tenantUser.findUnique).mockResolvedValue(mockMembership as never);
      const resolver = new Auth0TenantResolver(prisma);

      const result = await resolver.resolve({
        sub: "auth0|user_xyz",
        org_id: "org_abc123",
        "https://adpropia.app/superadmin": false
      });

      expect(result.role).toBe("ADMIN");
    });

    it("falls through to membership role when superadmin flag is absent", async () => {
      const prisma = createPrismaMock();
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(mockTenant as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);
      vi.mocked(prisma.tenantUser.findUnique).mockResolvedValue(mockMembership as never);
      const resolver = new Auth0TenantResolver(prisma);

      const result = await resolver.resolve({
        sub: "auth0|user_xyz",
        org_id: "org_abc123"
      });

      expect(result.role).toBe("ADMIN");
    });
  });
});
