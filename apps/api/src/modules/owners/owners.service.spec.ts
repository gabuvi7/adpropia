import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../common/prisma";
import type { RequestContextService } from "../../common/request-context/request-context.service";
import type { AuditService } from "../audit/audit.service";
import { OwnersService } from "./owners.service";

function createPrismaMock() {
  return {
    owner: {
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

describe("OwnersService", () => {
  it("creates owners with the active tenantId", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const tx = { owner: { create: vi.fn().mockResolvedValue({ id: "owner-1", tenantId: "tenant-a" } as never) } };
    mockTransaction(prisma, tx);
    const service = new OwnersService(prisma, createContextMock("tenant-a"), audit);

    await service.createOwner({ displayName: "Ana Gómez", email: "ana@example.com" });

    expect(tx.owner.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: "tenant-a", displayName: "Ana Gómez", email: "ana@example.com" })
    });
  });

  it("writes owner creation audit in the same transaction", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const tx = { owner: { create: vi.fn().mockResolvedValue({ id: "owner-1", tenantId: "tenant-a" } as never) } };
    mockTransaction(prisma, tx);
    const service = new OwnersService(prisma, createContextMock("tenant-a"), audit);

    await service.createOwner({ displayName: "Ana Gómez", email: "ana@example.com", taxId: "20-123" });

    expect(audit.createEntryWithClient).toHaveBeenCalledWith(tx, expect.objectContaining({ tenantId: "tenant-a", userId: "user-1" }), {
      entityType: "owner",
      entityId: "owner-1",
      action: "owner.created",
      metadata: { name: "Ana Gómez" }
    });
  });

  it("rolls back owner creation when audit persistence fails", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    vi.mocked(audit.createEntryWithClient).mockRejectedValue(new Error("audit failed"));
    const tx = { owner: { create: vi.fn().mockResolvedValue({ id: "owner-1", tenantId: "tenant-a" } as never) } };
    mockTransaction(prisma, tx);
    const service = new OwnersService(prisma, createContextMock("tenant-a"), audit);

    await expect(service.createOwner({ displayName: "Ana Gómez", email: "ana@example.com" })).rejects.toThrow(
      "No pudimos crear el propietario"
    );

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(audit.createEntryWithClient).toHaveBeenCalledWith(tx, expect.any(Object), {
      entityType: "owner",
      entityId: "owner-1",
      action: "owner.created",
      metadata: { name: "Ana Gómez" }
    });
  });

  it("lists owners only for the active tenantId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.owner.findMany).mockResolvedValue([] as never);
    const service = new OwnersService(prisma, createContextMock("tenant-b"), createAuditMock());

    await service.listOwners();

    expect(prisma.owner.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-b", deletedAt: null },
      orderBy: { displayName: "asc" }
    });
  });

  it("gets owners by id and active tenantId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.owner.findFirst).mockResolvedValue({ id: "owner-1", tenantId: "tenant-c" } as never);
    const service = new OwnersService(prisma, createContextMock("tenant-c"), createAuditMock());

    await service.getOwnerById("owner-1");

    expect(prisma.owner.findFirst).toHaveBeenCalledWith({ where: { id: "owner-1", tenantId: "tenant-c", deletedAt: null } });
  });

  it("updates owners only after checking the active tenantId", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    vi.mocked(prisma.owner.findFirst).mockResolvedValue({ id: "owner-1", tenantId: "tenant-d" } as never);
    const tx = { owner: { update: vi.fn().mockResolvedValue({ id: "owner-1", tenantId: "tenant-d", displayName: "Nuevo nombre" } as never) } };
    mockTransaction(prisma, tx);
    const service = new OwnersService(prisma, createContextMock("tenant-d"), audit);

    await service.updateOwner("owner-1", { displayName: "Nuevo nombre" });

    expect(prisma.owner.findFirst).toHaveBeenCalledWith({ where: { id: "owner-1", tenantId: "tenant-d", deletedAt: null } });
    expect(tx.owner.update).toHaveBeenCalledWith({
      where: { id_tenantId: { id: "owner-1", tenantId: "tenant-d" } },
      data: { displayName: "Nuevo nombre" }
    });
    expect(audit.createEntryWithClient).toHaveBeenCalledWith(tx, expect.objectContaining({ tenantId: "tenant-d" }), {
      entityType: "owner",
      entityId: "owner-1",
      action: "owner.updated",
      metadata: { changedFields: ["displayName"] }
    });
  });

  it("rolls back owner updates when audit persistence fails", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    vi.mocked(prisma.owner.findFirst).mockResolvedValue({ id: "owner-1", tenantId: "tenant-d" } as never);
    vi.mocked(audit.createEntryWithClient).mockRejectedValue(new Error("audit failed"));
    const tx = { owner: { update: vi.fn().mockResolvedValue({ id: "owner-1", tenantId: "tenant-d" } as never) } };
    mockTransaction(prisma, tx);
    const service = new OwnersService(prisma, createContextMock("tenant-d"), audit);

    await expect(service.updateOwner("owner-1", { taxId: "20-123" })).rejects.toThrow("No pudimos actualizar el propietario");

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(audit.createEntryWithClient).toHaveBeenCalledWith(tx, expect.any(Object), {
      entityType: "owner",
      entityId: "owner-1",
      action: "owner.updated",
      metadata: { changedFields: ["taxId"] }
    });
  });
});
