import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { PrismaService } from "../../common/prisma";
import type { RequestContextService } from "../../common/request-context/request-context.service";
import type { AuthRole } from "../../common/auth/auth-role";
import type { AuditService } from "../audit/audit.service";
import { AdminProvisioningService } from "./admin-provisioning.service";

function createPrismaMock(): PrismaService {
  return {
    tenant: { update: vi.fn(), findUnique: vi.fn() },
    user: { update: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
    tenantUser: { findUnique: vi.fn(), findFirst: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn()
  } as unknown as PrismaService;
}

function createAuditMock(): AuditService {
  return {
    createEntry: vi.fn().mockResolvedValue({}),
    createEntryWithClient: vi.fn().mockResolvedValue({})
  } as unknown as AuditService;
}

function createContextMock(role: AuthRole = "ADMIN", tenantId = "tenant-1"): RequestContextService {
  return {
    get: () => ({ requestId: "req-1", userId: "user-1", tenantId, role }),
    getOptional: () => ({ requestId: "req-1", userId: "user-1", tenantId, role })
  } as unknown as RequestContextService;
}

function buildService(
  prisma: PrismaService,
  audit: AuditService = createAuditMock(),
  context: RequestContextService = createContextMock()
): AdminProvisioningService {
  return new AdminProvisioningService(prisma, audit, context);
}

const MOCK_TENANT_RESULT = {
  id: "tenant-1",
  name: "Test Tenant",
  slug: "test-tenant",
  status: "ACTIVE",
  auth0OrgId: "org_abc123"
} as const;

const MOCK_USER_RESULT = {
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
  isActive: true,
  auth0UserId: "auth0|abc123"
} as const;

const MOCK_USER_WITHOUT_AUTH0 = {
  id: "user-1",
  auth0UserId: null
} as const;

const MOCK_MEMBERSHIP_RESULT = {
  id: "membership-1",
  tenantId: "tenant-1",
  userId: "user-1",
  role: "OPERATOR",
  isActive: true,
  acceptedAt: new Date("2026-06-03T23:00:00.000Z")
} as const;

function createPrismaError(code: string) {
  return { code };
}

describe("AdminProvisioningService", () => {
  describe("linkTenantAuth0Org", () => {
    it("links an existing tenant to an unused Auth0 org ID and returns the updated tenant mapping", async () => {
      const prisma = createPrismaMock();
      const audit = createAuditMock();
      const tx = { tenant: { update: vi.fn().mockResolvedValue(MOCK_TENANT_RESULT as never) } };
      vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
        async (callback: (tx: unknown) => unknown) => callback(tx)
      );
      const service = buildService(prisma, audit);

      const result = await service.linkTenantAuth0Org("tenant-1", "org_abc123");

      expect(result).toEqual({ tenant: MOCK_TENANT_RESULT });
      expect(tx.tenant.update).toHaveBeenCalledWith({
        where: { id: "tenant-1" },
        data: { auth0OrgId: "org_abc123" },
        select: { id: true, name: true, slug: true, status: true, auth0OrgId: true }
      });
      expect(audit.createEntryWithClient).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ tenantId: "tenant-1" }),
        { tenantId: "tenant-1", entityType: "tenant", entityId: "tenant-1", action: "admin-provisioning.auth0-org.linked" }
      );
    });

    it("throws NotFoundException when the tenant does not exist (P2025)", async () => {
      const prisma = createPrismaMock();
      vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockRejectedValue(
        createPrismaError("P2025") as never
      );
      const service = buildService(prisma, createAuditMock(), createContextMock("SUPERADMIN", "platform"));

      await expect(service.linkTenantAuth0Org("nonexistent", "org_xyz")).rejects.toThrow(NotFoundException);
    });

    it("throws ConflictException when the Auth0 org ID is already linked to another tenant (P2002)", async () => {
      const prisma = createPrismaMock();
      vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockRejectedValue(
        createPrismaError("P2002") as never
      );
      const service = buildService(prisma);

      await expect(service.linkTenantAuth0Org("tenant-1", "org_abc123")).rejects.toThrow(ConflictException);
    });

    it("rejects non-SUPERADMIN callers linking an Auth0 org for another tenant", async () => {
      const prisma = createPrismaMock();
      const service = buildService(prisma);

      await expect(service.linkTenantAuth0Org("tenant-2", "org_xyz")).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("allows SUPERADMIN callers to link an Auth0 org for another tenant", async () => {
      const prisma = createPrismaMock();
      const tx = { tenant: { update: vi.fn().mockResolvedValue({ ...MOCK_TENANT_RESULT, id: "tenant-2" } as never) } };
      vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
        async (callback: (tx: unknown) => unknown) => callback(tx)
      );
      const service = buildService(prisma, createAuditMock(), createContextMock("SUPERADMIN", "platform"));

      await expect(service.linkTenantAuth0Org("tenant-2", "org_xyz")).resolves.toEqual({
        tenant: { ...MOCK_TENANT_RESULT, id: "tenant-2" }
      });
    });
  });

  describe("linkUserAuth0Subject", () => {
    it("links an existing user to an unused Auth0 subject and returns the updated user mapping", async () => {
      const prisma = createPrismaMock();
      const audit = createAuditMock();
      const tx = {
        tenantUser: {
          findUnique: vi.fn().mockResolvedValue({ id: "membership-1", isActive: true, role: "ADMIN" } as never),
          findFirst: vi.fn().mockResolvedValue(null as never)
        },
        user: { findUnique: vi.fn().mockResolvedValue(MOCK_USER_RESULT as never), updateMany: vi.fn().mockResolvedValue({ count: 1 } as never) }
      };
      vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
        async (callback: (tx: unknown) => unknown) => callback(tx)
      );
      const service = buildService(prisma, audit);

      const result = await service.linkUserAuth0Subject("user-1", "auth0|abc123");

      expect(result).toEqual({ user: MOCK_USER_RESULT });
      expect(tx.user.updateMany).toHaveBeenCalledWith({
        where: { id: "user-1", auth0UserId: null },
        data: { auth0UserId: "auth0|abc123" }
      });
      expect(audit.createEntryWithClient).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ userId: "user-1" }),
        { entityType: "user", entityId: "user-1", action: "admin-provisioning.auth0-subject.linked" }
      );
      expect(tx.tenantUser.findUnique).toHaveBeenCalledWith({
        where: { tenantId_userId: { tenantId: "tenant-1", userId: "user-1" } },
        select: { id: true, isActive: true, role: true }
      });
      expect(tx.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-1" },
        select: { id: true, email: true, name: true, isActive: true, auth0UserId: true }
      });
    });

    it("throws NotFoundException when the user does not exist (P2025)", async () => {
      const prisma = createPrismaMock();
      vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockRejectedValue(
        createPrismaError("P2025") as never
      );
      const service = buildService(prisma);

      await expect(service.linkUserAuth0Subject("nonexistent", "auth0|xyz")).rejects.toThrow(NotFoundException);
    });

    it("throws ConflictException when the Auth0 subject is already linked to another user (P2002)", async () => {
      const prisma = createPrismaMock();
      vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockRejectedValue(
        createPrismaError("P2002") as never
      );
      const service = buildService(prisma);

      await expect(service.linkUserAuth0Subject("user-2", "auth0|abc123")).rejects.toThrow(ConflictException);
    });

    it("rejects non-SUPERADMIN callers linking an Auth0 subject for a user outside the active tenant", async () => {
      const prisma = createPrismaMock();
      vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
        async (callback: (tx: unknown) => unknown) => callback(prisma)
      );
      vi.mocked(prisma.tenantUser.findUnique).mockResolvedValue(null as never);
      const service = buildService(prisma);

      await expect(service.linkUserAuth0Subject("user-2", "auth0|xyz")).rejects.toThrow(
        "No podés provisionar fuera del tenant activo."
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("rejects OPERATOR callers linking an Auth0 subject at the service layer", async () => {
      const prisma = createPrismaMock();
      const service = buildService(prisma, createAuditMock(), createContextMock("OPERATOR"));

      await expect(service.linkUserAuth0Subject("user-1", "auth0|xyz")).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("allows non-SUPERADMIN callers to link an Auth0 subject for a user in the active tenant", async () => {
      const prisma = createPrismaMock();
      vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
        async (callback: (tx: unknown) => unknown) => callback(prisma)
      );
      vi.mocked(prisma.tenantUser.findUnique).mockResolvedValue({ id: "membership-1", isActive: true, role: "ADMIN" } as never);
      vi.mocked(prisma.tenantUser.findFirst).mockResolvedValue(null as never);
      vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 } as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(MOCK_USER_RESULT as never);
      const service = buildService(prisma);

      await expect(service.linkUserAuth0Subject("user-1", "auth0|abc123")).resolves.toEqual({ user: MOCK_USER_RESULT });
      expect(prisma.tenantUser.findUnique).toHaveBeenCalledWith({
        where: { tenantId_userId: { tenantId: "tenant-1", userId: "user-1" } },
        select: { id: true, isActive: true, role: true }
      });
      expect(prisma.tenantUser.findFirst).toHaveBeenCalledWith({
        where: { userId: "user-1", role: "OWNER", isActive: true },
        select: { id: true }
      });
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: "user-1", auth0UserId: null },
        data: { auth0UserId: "auth0|abc123" }
      });
    });

    it.each(["ADMIN", "OPERATOR", "READONLY"] as const)(
      "rejects ADMIN callers linking an Auth0 subject when the user is OWNER in another active tenant and %s in caller tenant",
      async (callerTenantRole) => {
        const prisma = createPrismaMock();
        vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
          async (callback: (tx: unknown) => unknown) => callback(prisma)
        );
        vi.mocked(prisma.tenantUser.findUnique).mockResolvedValue({ id: "membership-1", isActive: true, role: callerTenantRole } as never);
        vi.mocked(prisma.tenantUser.findFirst).mockResolvedValue({ id: "owner-membership-1" } as never);
        const service = buildService(prisma);

        await expect(service.linkUserAuth0Subject("user-1", "auth0|owner-other-tenant")).rejects.toThrow(
          "No podés vincular el subject de Auth0 de un OWNER."
        );
        expect(prisma.user.updateMany).not.toHaveBeenCalled();
        expect(prisma.user.update).not.toHaveBeenCalled();
      }
    );

    it("rejects ADMIN callers linking an Auth0 subject for an OWNER user in the active tenant", async () => {
      const prisma = createPrismaMock();
      vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
        async (callback: (tx: unknown) => unknown) => callback(prisma)
      );
      vi.mocked(prisma.tenantUser.findUnique).mockResolvedValue({ id: "membership-1", isActive: true, role: "OWNER" } as never);
      const service = buildService(prisma);

      await expect(service.linkUserAuth0Subject("user-1", "auth0|owner")).rejects.toThrow(
        "No podés vincular el subject de Auth0 de un OWNER."
      );
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("rejects ADMIN callers overwriting an existing Auth0 subject atomically when the conditional update affects no rows", async () => {
      const prisma = createPrismaMock();
      vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
        async (callback: (tx: unknown) => unknown) => callback(prisma)
      );
      vi.mocked(prisma.tenantUser.findUnique).mockResolvedValue({ id: "membership-1", isActive: true, role: "ADMIN" } as never);
      vi.mocked(prisma.tenantUser.findFirst).mockResolvedValue(null as never);
      vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 0 } as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1", auth0UserId: "auth0|existing" } as never);
      const service = buildService(prisma);

      await expect(service.linkUserAuth0Subject("user-1", "auth0|replacement")).rejects.toThrow(
        "No podés sobrescribir un subject de Auth0 existente."
      );
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: "user-1", auth0UserId: null },
        data: { auth0UserId: "auth0|replacement" }
      });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("allows SUPERADMIN callers to link or overwrite an OWNER user's Auth0 subject", async () => {
      const prisma = createPrismaMock();
      vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
        async (callback: (tx: unknown) => unknown) => callback(prisma)
      );
      vi.mocked(prisma.user.update).mockResolvedValue({ ...MOCK_USER_RESULT, auth0UserId: "auth0|replacement" } as never);
      const service = buildService(prisma, createAuditMock(), createContextMock("SUPERADMIN", "platform"));

      await expect(service.linkUserAuth0Subject("user-1", "auth0|replacement")).resolves.toEqual({
        user: { ...MOCK_USER_RESULT, auth0UserId: "auth0|replacement" }
      });
      expect(prisma.tenantUser.findUnique).not.toHaveBeenCalled();
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { auth0UserId: "auth0|replacement" },
        select: { id: true, email: true, name: true, isActive: true, auth0UserId: true }
      });
    });
  });

  describe("provisionMembership", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-06-03T23:00:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("creates a membership with acceptedAt set to current server time and writes audit inside transaction", async () => {
      const prisma = createPrismaMock();
      const audit = createAuditMock();
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue({ id: "tenant-1" } as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1" } as never);
      vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
        async (callback: (tx: unknown) => unknown) => callback(prisma)
      );
      vi.mocked(prisma.tenantUser.upsert).mockResolvedValue(MOCK_MEMBERSHIP_RESULT as never);
      const service = buildService(prisma, audit);

      const result = await service.provisionMembership({
        tenantId: "tenant-1",
        userId: "user-1",
        role: "OPERATOR"
      });

      expect(result).toEqual({ membership: MOCK_MEMBERSHIP_RESULT });
      expect(prisma.tenantUser.upsert).toHaveBeenCalledWith({
        where: { tenantId_userId: { tenantId: "tenant-1", userId: "user-1" } },
        create: {
          tenantId: "tenant-1",
          userId: "user-1",
          role: "OPERATOR",
          isActive: true,
          acceptedAt: new Date("2026-06-03T23:00:00.000Z")
        },
        update: {
          role: "OPERATOR",
          isActive: true,
          acceptedAt: new Date("2026-06-03T23:00:00.000Z")
        },
        select: { id: true, tenantId: true, userId: true, role: true, isActive: true, acceptedAt: true }
      });
      expect(audit.createEntryWithClient).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ tenantId: "tenant-1" }),
        expect.objectContaining({ tenantId: "tenant-1", action: "admin-provisioning.membership.provisioned" })
      );
    });

    it("updates an existing membership role and acceptedAt", async () => {
      const prisma = createPrismaMock();
      const audit = createAuditMock();
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue({ id: "tenant-1" } as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1" } as never);
      vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
        async (callback: (tx: unknown) => unknown) => callback(prisma)
      );
      const updatedMembership = { ...MOCK_MEMBERSHIP_RESULT, role: "ADMIN" };
      vi.mocked(prisma.tenantUser.upsert).mockResolvedValue(updatedMembership as never);
      const service = buildService(prisma, audit);

      const result = await service.provisionMembership({
        tenantId: "tenant-1",
        userId: "user-1",
        role: "ADMIN"
      });

      expect(result).toEqual({ membership: updatedMembership });
      expect(prisma.tenantUser.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId_userId: { tenantId: "tenant-1", userId: "user-1" } },
          update: expect.objectContaining({ role: "ADMIN" }),
          create: expect.objectContaining({ role: "ADMIN" })
        })
      );
    });

    it.each(["ADMIN", "OPERATOR", "READONLY"] as const)(
      "allows ADMIN callers to provision %s memberships within the active tenant",
      async (role) => {
        const prisma = createPrismaMock();
        vi.mocked(prisma.tenant.findUnique).mockResolvedValue({ id: "tenant-1" } as never);
        vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1" } as never);
        vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
          async (callback: (tx: unknown) => unknown) => callback(prisma)
        );
        vi.mocked(prisma.tenantUser.upsert).mockResolvedValue({ ...MOCK_MEMBERSHIP_RESULT, role } as never);
        const service = buildService(prisma);

        await expect(service.provisionMembership({ tenantId: "tenant-1", userId: "user-1", role })).resolves.toEqual({
          membership: { ...MOCK_MEMBERSHIP_RESULT, role }
        });
      }
    );

    it("rejects ADMIN callers provisioning OWNER memberships", async () => {
      const prisma = createPrismaMock();
      const service = buildService(prisma);

      await expect(
        service.provisionMembership({ tenantId: "tenant-1", userId: "user-1", role: "OWNER" })
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rejects ADMIN callers provisioning memberships for another tenant", async () => {
      const prisma = createPrismaMock();
      const service = buildService(prisma);

      await expect(
        service.provisionMembership({ tenantId: "tenant-2", userId: "user-1", role: "OPERATOR" })
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("allows OWNER callers to provision OWNER memberships within the active tenant", async () => {
      const prisma = createPrismaMock();
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue({ id: "tenant-1" } as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1" } as never);
      vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
        async (callback: (tx: unknown) => unknown) => callback(prisma)
      );
      vi.mocked(prisma.tenantUser.upsert).mockResolvedValue({ ...MOCK_MEMBERSHIP_RESULT, role: "OWNER" } as never);
      const service = buildService(prisma, createAuditMock(), createContextMock("OWNER"));

      await expect(
        service.provisionMembership({ tenantId: "tenant-1", userId: "user-1", role: "OWNER" })
      ).resolves.toEqual({ membership: { ...MOCK_MEMBERSHIP_RESULT, role: "OWNER" } });
    });

    it("rejects OPERATOR and READONLY callers at the service layer", async () => {
      const prisma = createPrismaMock();

      await expect(
        buildService(prisma, createAuditMock(), createContextMock("OPERATOR")).provisionMembership({
          tenantId: "tenant-1",
          userId: "user-1",
          role: "READONLY"
        })
      ).rejects.toThrow(ForbiddenException);
      await expect(
        buildService(prisma, createAuditMock(), createContextMock("READONLY")).provisionMembership({
          tenantId: "tenant-1",
          userId: "user-1",
          role: "READONLY"
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it("allows SUPERADMIN callers to provision memberships for another tenant", async () => {
      const prisma = createPrismaMock();
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue({ id: "tenant-2" } as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1" } as never);
      vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
        async (callback: (tx: unknown) => unknown) => callback(prisma)
      );
      vi.mocked(prisma.tenantUser.upsert).mockResolvedValue({ ...MOCK_MEMBERSHIP_RESULT, tenantId: "tenant-2", role: "OWNER" } as never);
      const service = buildService(prisma, createAuditMock(), createContextMock("SUPERADMIN", "platform"));

      await expect(
        service.provisionMembership({ tenantId: "tenant-2", userId: "user-1", role: "OWNER" })
      ).resolves.toEqual({ membership: { ...MOCK_MEMBERSHIP_RESULT, tenantId: "tenant-2", role: "OWNER" } });
    });

    it("throws NotFoundException when tenant does not exist", async () => {
      const prisma = createPrismaMock();
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null as never);
      vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
        async (callback: (tx: unknown) => unknown) => callback(prisma)
      );
      const service = buildService(prisma, createAuditMock(), createContextMock("ADMIN", "nonexistent"));

      await expect(
        service.provisionMembership({ tenantId: "nonexistent", userId: "user-1", role: "OPERATOR" })
      ).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException when user does not exist", async () => {
      const prisma = createPrismaMock();
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue({ id: "tenant-1" } as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);
      vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
        async (callback: (tx: unknown) => unknown) => callback(prisma)
      );
      const service = buildService(prisma);

      await expect(
        service.provisionMembership({ tenantId: "tenant-1", userId: "nonexistent", role: "OPERATOR" })
      ).rejects.toThrow(NotFoundException);
    });
  });
});
