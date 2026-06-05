import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../common/prisma";
import type { RequestContextService } from "../../common/request-context/request-context.service";
import type { AuditService } from "../audit/audit.service";
import { RentersService } from "./renters.service";

function createPrismaMock() {
  return {
    renter: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn()
    },
    $transaction: vi.fn()
  } as unknown as PrismaService;
}

function createContextMock(tenantId = "tenant-a") {
  return {
    get: () => ({ requestId: "req-1", userId: "user-1", tenantId, role: "ADMIN" })
  } as RequestContextService;
}

function createAuditMock(): AuditService {
  return {
    createEntry: vi.fn().mockResolvedValue({}),
    createEntryWithClient: vi.fn().mockResolvedValue({})
  } as unknown as AuditService;
}

function mockTransaction(prisma: PrismaService, tx: unknown) {
  vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
    async (callback: (tx: unknown) => unknown) => callback(tx)
  );
}

describe("RentersService", () => {
  it("creates renters with the active tenantId", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const tx = { renter: { create: vi.fn().mockResolvedValue({ id: "renter-1", tenantId: "tenant-a" } as never) } };
    mockTransaction(prisma, tx);
    const service = new RentersService(prisma, createContextMock("tenant-a"), audit);

    await service.createRenter({ displayName: "Juan Pérez", identityNumber: "12345678" });

    expect(tx.renter.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: "tenant-a", displayName: "Juan Pérez", identityNumber: "12345678" })
    });
  });

  it("writes renter creation audit in the same transaction", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const tx = { renter: { create: vi.fn().mockResolvedValue({ id: "renter-1", tenantId: "tenant-a" } as never) } };
    mockTransaction(prisma, tx);
    const service = new RentersService(prisma, createContextMock("tenant-a"), audit);

    await service.createRenter({ displayName: "Juan Pérez", identityNumber: "12345678" });

    expect(audit.createEntryWithClient).toHaveBeenCalledWith(tx, expect.objectContaining({ tenantId: "tenant-a", userId: "user-1" }), {
      entityType: "renter",
      entityId: "renter-1",
      action: "renter.created",
      metadata: { name: "Juan Pérez" }
    });
  });

  it("rolls back renter creation when audit persistence fails", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    vi.mocked(audit.createEntryWithClient).mockRejectedValue(new Error("audit failed"));
    const tx = { renter: { create: vi.fn().mockResolvedValue({ id: "renter-1", tenantId: "tenant-a" } as never) } };
    mockTransaction(prisma, tx);
    const service = new RentersService(prisma, createContextMock("tenant-a"), audit);

    await expect(service.createRenter({ displayName: "Juan Pérez", identityNumber: "12345678" })).rejects.toThrow(
      "No pudimos crear el inquilino"
    );

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(audit.createEntryWithClient).toHaveBeenCalledWith(tx, expect.any(Object), {
      entityType: "renter",
      entityId: "renter-1",
      action: "renter.created",
      metadata: { name: "Juan Pérez" }
    });
  });

  it("lists renters only for the active tenantId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.renter.findMany).mockResolvedValue([] as never);
    const service = new RentersService(prisma, createContextMock("tenant-b"), createAuditMock());

    await service.listRenters();

    expect(prisma.renter.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-b", deletedAt: null },
      orderBy: { displayName: "asc" }
    });
  });

  it("gets renters by id and active tenantId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.renter.findFirst).mockResolvedValue({ id: "renter-1", tenantId: "tenant-c" } as never);
    const service = new RentersService(prisma, createContextMock("tenant-c"), createAuditMock());

    await service.getRenterById("renter-1");

    expect(prisma.renter.findFirst).toHaveBeenCalledWith({ where: { id: "renter-1", tenantId: "tenant-c", deletedAt: null } });
  });

  it("updates renters only after checking the active tenantId", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    vi.mocked(prisma.renter.findFirst).mockResolvedValue({ id: "renter-1", tenantId: "tenant-d" } as never);
    const tx = { renter: { update: vi.fn().mockResolvedValue({ id: "renter-1", tenantId: "tenant-d", displayName: "Nuevo nombre" } as never) } };
    mockTransaction(prisma, tx);
    const service = new RentersService(prisma, createContextMock("tenant-d"), audit);

    await service.updateRenter("renter-1", { displayName: "Nuevo nombre" });

    expect(prisma.renter.findFirst).toHaveBeenCalledWith({ where: { id: "renter-1", tenantId: "tenant-d", deletedAt: null } });
    expect(tx.renter.update).toHaveBeenCalledWith({
      where: { id_tenantId: { id: "renter-1", tenantId: "tenant-d" } },
      data: { displayName: "Nuevo nombre" }
    });
    expect(audit.createEntryWithClient).toHaveBeenCalledWith(tx, expect.objectContaining({ tenantId: "tenant-d" }), {
      entityType: "renter",
      entityId: "renter-1",
      action: "renter.updated",
      metadata: { changedFields: ["displayName"] }
    });
  });

  it("redacts renter sensitive update values to changed fields only", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    vi.mocked(prisma.renter.findFirst).mockResolvedValue({ id: "renter-1", tenantId: "tenant-d" } as never);
    const tx = { renter: { update: vi.fn().mockResolvedValue({ id: "renter-1", tenantId: "tenant-d" } as never) } };
    mockTransaction(prisma, tx);
    const service = new RentersService(prisma, createContextMock("tenant-d"), audit);

    await service.updateRenter("renter-1", { identityNumber: "12345678", guaranteeInfo: { coSigner: "Ada" } });

    expect(audit.createEntryWithClient).toHaveBeenCalledWith(tx, expect.any(Object), {
      entityType: "renter",
      entityId: "renter-1",
      action: "renter.updated",
      metadata: { changedFields: ["guaranteeInfo", "identityNumber"] }
    });
  });

  it("rolls back renter updates when audit persistence fails", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    vi.mocked(prisma.renter.findFirst).mockResolvedValue({ id: "renter-1", tenantId: "tenant-d" } as never);
    vi.mocked(audit.createEntryWithClient).mockRejectedValue(new Error("audit failed"));
    const tx = { renter: { update: vi.fn().mockResolvedValue({ id: "renter-1", tenantId: "tenant-d" } as never) } };
    mockTransaction(prisma, tx);
    const service = new RentersService(prisma, createContextMock("tenant-d"), audit);

    await expect(service.updateRenter("renter-1", { guaranteeInfo: { coSigner: "Ada" } })).rejects.toThrow(
      "No pudimos actualizar el inquilino"
    );

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(audit.createEntryWithClient).toHaveBeenCalledWith(tx, expect.any(Object), {
      entityType: "renter",
      entityId: "renter-1",
      action: "renter.updated",
      metadata: { changedFields: ["guaranteeInfo"] }
    });
  });
});
