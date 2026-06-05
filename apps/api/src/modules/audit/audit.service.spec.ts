import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../common/prisma";
import { AuditService } from "./audit.service";

function createPrismaMock() {
  const auditLog = { create: vi.fn(), findMany: vi.fn(), count: vi.fn() };
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

  describe("listAuditLogs", () => {
    it("filters audit logs and returns newest-first pagination metadata", async () => {
      const prisma = createPrismaMock();
      const newestLog = {
        id: "audit-newest",
        tenantId: "tenant-2",
        userId: "user-2",
        requestId: "req-2",
        entityType: "payment",
        entityId: "payment-2",
        action: "payment.created",
        metadata: { amountCents: 50000 },
        createdAt: new Date("2026-06-05T12:00:00.000Z")
      };
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([newestLog] as never);
      vi.mocked(prisma.auditLog.count).mockResolvedValue(7 as never);
      const service = new AuditService(prisma);

      const result = await service.listAuditLogs({
        tenantId: "tenant-2",
        entityType: "payment",
        entityId: "payment-2",
        action: "payment.created",
        userId: "user-2",
        from: new Date("2026-06-01T00:00:00.000Z"),
        to: new Date("2026-06-05T23:59:59.999Z"),
        page: 2,
        pageSize: 25
      });

      const expectedWhere = {
        tenantId: "tenant-2",
        entityType: "payment",
        entityId: "payment-2",
        action: "payment.created",
        userId: "user-2",
        createdAt: {
          gte: new Date("2026-06-01T00:00:00.000Z"),
          lte: new Date("2026-06-05T23:59:59.999Z")
        }
      };
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: expectedWhere,
        orderBy: { createdAt: "desc" },
        skip: 25,
        take: 25
      });
      expect(prisma.auditLog.count).toHaveBeenCalledWith({ where: expectedWhere });
      expect(result).toEqual({ items: [newestLog], page: 2, pageSize: 25, total: 7 });
    });

    it("returns an empty valid page when no audit logs match", async () => {
      const prisma = createPrismaMock();
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([] as never);
      vi.mocked(prisma.auditLog.count).mockResolvedValue(0 as never);
      const service = new AuditService(prisma);

      const result = await service.listAuditLogs({ entityType: "owner", page: 1, pageSize: 50 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { entityType: "owner" },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 50
      });
      expect(result).toEqual({ items: [], page: 1, pageSize: 50, total: 0 });
    });
  });
});
