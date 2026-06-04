import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../common/prisma";
import { AuditService } from "./audit.service";

function createPrismaMock() {
  const auditLog = { create: vi.fn() };
  return { auditLog } as unknown as PrismaService;
}

describe("AuditService", () => {
  const context = {
    tenantId: "tenant-1",
    userId: "user-1",
    requestId: "req-1",
    role: "ADMIN" as const
  };

  describe("createEntry", () => {
    it("persists an audit log entry via prisma.auditLog.create", async () => {
      const prisma = createPrismaMock();
      const created = {
        id: "log-1",
        tenantId: "tenant-1",
        userId: "user-1",
        requestId: "req-1",
        entityType: "contract",
        entityId: "contract-1",
        action: "contract.created",
        metadata: null,
        createdAt: new Date()
      };
      vi.mocked(prisma.auditLog.create).mockResolvedValue(created as never);
      const service = new AuditService(prisma);

      const result = await service.createEntry(context, {
        entityType: "contract",
        entityId: "contract-1",
        action: "contract.created"
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          tenantId: "tenant-1",
          userId: "user-1",
          requestId: "req-1",
          entityType: "contract",
          entityId: "contract-1",
          action: "contract.created"
        }
      });
      expect(result).toEqual(created);
    });

    it("includes metadata when provided", async () => {
      const prisma = createPrismaMock();
      vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: "log-2" } as never);
      const service = new AuditService(prisma);

      await service.createEntry(context, {
        entityType: "tenant",
        action: "tenant.created",
        metadata: { slug: "my-tenant", name: "My Tenant" }
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          tenantId: "tenant-1",
          userId: "user-1",
          requestId: "req-1",
          entityType: "tenant",
          entityId: null,
          action: "tenant.created",
          metadata: { slug: "my-tenant", name: "My Tenant" }
        }
      });
    });
  });

  describe("createEntryWithClient", () => {
    it("writes to the provided client instead of the default prisma instance", async () => {
      const client = { auditLog: { create: vi.fn() } };
      client.auditLog.create.mockResolvedValue({ id: "tx-log-1" } as never);
      const service = new AuditService(createPrismaMock());

      const result = await service.createEntryWithClient(client, context, {
        entityType: "payment",
        action: "payment.created"
      });

      expect(client.auditLog.create).toHaveBeenCalledWith({
        data: {
          tenantId: "tenant-1",
          userId: "user-1",
          requestId: "req-1",
          entityType: "payment",
          entityId: null,
          action: "payment.created"
        }
      });
      expect(result).toEqual({ id: "tx-log-1" });
    });

    it("overrides tenantId when input.tenantId is provided (cross-tenant operation)", async () => {
      const client = { auditLog: { create: vi.fn() } };
      client.auditLog.create.mockResolvedValue({ id: "cross-tenant-log" } as never);
      const service = new AuditService(createPrismaMock());

      await service.createEntryWithClient(client, context, {
        entityType: "tenant",
        entityId: "target-tenant-id",
        action: "tenant.created",
        tenantId: "target-tenant-id"
      });

      expect(client.auditLog.create).toHaveBeenCalledWith({
        data: {
          tenantId: "target-tenant-id",
          userId: "user-1",
          requestId: "req-1",
          entityType: "tenant",
          entityId: "target-tenant-id",
          action: "tenant.created"
        }
      });
    });
  });
});
