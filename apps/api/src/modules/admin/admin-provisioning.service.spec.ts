import { ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { PrismaService } from "../../common/prisma";
import type { RequestContextService } from "../../common/request-context/request-context.service";
import type { AuditService } from "../audit/audit.service";
import { AdminProvisioningService } from "./admin-provisioning.service";

function createPrismaMock(): PrismaService {
  return {
    tenant: { update: vi.fn(), findUnique: vi.fn() },
    user: { update: vi.fn(), findUnique: vi.fn() },
    tenantUser: { upsert: vi.fn() },
    $transaction: vi.fn()
  } as unknown as PrismaService;
}

function createAuditMock(): AuditService {
  return {
    createEntry: vi.fn().mockResolvedValue({}),
    createEntryWithClient: vi.fn().mockResolvedValue({})
  } as unknown as AuditService;
}

function createContextMock(): RequestContextService {
  return {
    get: () => ({ requestId: "req-1", userId: "user-1", tenantId: "tenant-1", role: "ADMIN" }),
    getOptional: () => ({ requestId: "req-1", userId: "user-1", tenantId: "tenant-1", role: "ADMIN" })
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
      const service = buildService(prisma);

      await expect(service.linkTenantAuth0Org("nonexistent", "org_xyz")).rejects.toThrow(NotFoundException);
    });

    it("throws ConflictException when the Auth0 org ID is already linked to another tenant (P2002)", async () => {
      const prisma = createPrismaMock();
      vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockRejectedValue(
        createPrismaError("P2002") as never
      );
      const service = buildService(prisma);

      await expect(service.linkTenantAuth0Org("tenant-2", "org_abc123")).rejects.toThrow(ConflictException);
    });
  });

  describe("linkUserAuth0Subject", () => {
    it("links an existing user to an unused Auth0 subject and returns the updated user mapping", async () => {
      const prisma = createPrismaMock();
      const audit = createAuditMock();
      const tx = { user: { update: vi.fn().mockResolvedValue(MOCK_USER_RESULT as never) } };
      vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
        async (callback: (tx: unknown) => unknown) => callback(tx)
      );
      const service = buildService(prisma, audit);

      const result = await service.linkUserAuth0Subject("user-1", "auth0|abc123");

      expect(result).toEqual({ user: MOCK_USER_RESULT });
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { auth0UserId: "auth0|abc123" },
        select: { id: true, email: true, name: true, isActive: true, auth0UserId: true }
      });
      expect(audit.createEntryWithClient).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ userId: "user-1" }),
        { entityType: "user", entityId: "user-1", action: "admin-provisioning.auth0-subject.linked" }
      );
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

    it("throws NotFoundException when tenant does not exist", async () => {
      const prisma = createPrismaMock();
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null as never);
      vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
        async (callback: (tx: unknown) => unknown) => callback(prisma)
      );
      const service = buildService(prisma);

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
