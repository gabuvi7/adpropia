import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../common/prisma";
import type { RequestContextService } from "../../common/request-context/request-context.service";
import type { AuditService } from "../audit/audit.service";
import { PropertiesService } from "./properties.service";

function createPrismaMock() {
  return {
    owner: {
      findFirst: vi.fn()
    },
    property: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn()
    },
    persona: {
      findMany: vi.fn()
    },
    rentalContract: {
      count: vi.fn()
    },
    propertyTypeCatalog: {
      findFirst: vi.fn()
    },
    serviceType: {
      findMany: vi.fn()
    },
    propertyOwner: {
      deleteMany: vi.fn(),
      createMany: vi.fn()
    },
    propertyService: {
      deleteMany: vi.fn(),
      createMany: vi.fn()
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

describe("PropertiesService", () => {
  it("checks owner id and active tenantId before creating properties", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    vi.mocked(prisma.owner.findFirst).mockResolvedValue({ id: "owner-1", tenantId: "tenant-a" } as never);
    const tx = { property: { create: vi.fn().mockResolvedValue({ id: "property-1", tenantId: "tenant-a", ownerId: "owner-1" } as never) } };
    mockTransaction(prisma, tx);
    const service = new PropertiesService(prisma, createContextMock("tenant-a"), audit);

    await service.createProperty({ ownerId: "owner-1", type: "APARTMENT", addressLine: "Av. Siempre Viva 123" });

    expect(prisma.owner.findFirst).toHaveBeenCalledWith({ where: { id: "owner-1", tenantId: "tenant-a", deletedAt: null } });
    expect(tx.property.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: "tenant-a", ownerId: "owner-1", type: "APARTMENT", addressLine: "Av. Siempre Viva 123" })
    });
    expect(audit.createEntryWithClient).toHaveBeenCalledWith(tx, expect.objectContaining({ tenantId: "tenant-a" }), {
      entityType: "property",
      entityId: "property-1",
      action: "property.created",
      metadata: { ownerId: "owner-1" }
    });
  });

  it("lists properties only for the active tenantId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.property.findMany).mockResolvedValue([] as never);
    const service = new PropertiesService(prisma, createContextMock("tenant-b"), createAuditMock());

    await service.listProperties();

    expect(prisma.property.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-b", deletedAt: null },
      orderBy: { addressLine: "asc" }
    });
  });

  it("gets properties by id and active tenantId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.property.findFirst).mockResolvedValue({ id: "property-1", tenantId: "tenant-c" } as never);
    const service = new PropertiesService(prisma, createContextMock("tenant-c"), createAuditMock());

    await service.getPropertyById("property-1");

    expect(prisma.property.findFirst).toHaveBeenCalledWith({ where: { id: "property-1", tenantId: "tenant-c", deletedAt: null } });
  });

  it("updates properties with compound id_tenantId after checking active tenantId", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    vi.mocked(prisma.property.findFirst).mockResolvedValue({ id: "property-1", tenantId: "tenant-d", ownerId: "owner-1" } as never);
    const tx = { property: { update: vi.fn().mockResolvedValue({ id: "property-1", tenantId: "tenant-d", addressLine: "Nueva dirección" } as never) } };
    mockTransaction(prisma, tx);
    const service = new PropertiesService(prisma, createContextMock("tenant-d"), audit);

    await service.updateProperty("property-1", { addressLine: "Nueva dirección" });

    expect(prisma.property.findFirst).toHaveBeenCalledWith({ where: { id: "property-1", tenantId: "tenant-d", deletedAt: null } });
    expect(tx.property.update).toHaveBeenCalledWith({
      where: { id_tenantId: { id: "property-1", tenantId: "tenant-d" } },
      data: { addressLine: "Nueva dirección" }
    });
    expect(audit.createEntryWithClient).toHaveBeenCalledWith(tx, expect.objectContaining({ tenantId: "tenant-d" }), {
      entityType: "property",
      entityId: "property-1",
      action: "property.updated",
      metadata: { changedFields: ["addressLine"] }
    });
  });

  it("checks new owner id and active tenantId before reassigning properties", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    vi.mocked(prisma.property.findFirst).mockResolvedValue({ id: "property-1", tenantId: "tenant-e", ownerId: "owner-1" } as never);
    vi.mocked(prisma.owner.findFirst).mockResolvedValue({ id: "owner-2", tenantId: "tenant-e" } as never);
    const tx = { property: { update: vi.fn().mockResolvedValue({ id: "property-1", tenantId: "tenant-e", ownerId: "owner-2" } as never) } };
    mockTransaction(prisma, tx);
    const service = new PropertiesService(prisma, createContextMock("tenant-e"), audit);

    await service.updateProperty("property-1", { ownerId: "owner-2" });

    expect(prisma.owner.findFirst).toHaveBeenCalledWith({ where: { id: "owner-2", tenantId: "tenant-e", deletedAt: null } });
    expect(tx.property.update).toHaveBeenCalledWith({
      where: { id_tenantId: { id: "property-1", tenantId: "tenant-e" } },
      data: { ownerId: "owner-2" }
    });
    expect(audit.createEntryWithClient).toHaveBeenCalledWith(tx, expect.objectContaining({ tenantId: "tenant-e" }), {
      entityType: "property",
      entityId: "property-1",
      action: "property.updated",
      metadata: { changedFields: ["ownerId"] }
    });
  });

  it("rolls back property creation when audit persistence fails", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    vi.mocked(prisma.owner.findFirst).mockResolvedValue({ id: "owner-1", tenantId: "tenant-a" } as never);
    vi.mocked(audit.createEntryWithClient).mockRejectedValue(new Error("audit failed"));
    const tx = { property: { create: vi.fn().mockResolvedValue({ id: "property-1", tenantId: "tenant-a", ownerId: "owner-1" } as never) } };
    mockTransaction(prisma, tx);
    const service = new PropertiesService(prisma, createContextMock("tenant-a"), audit);

    await expect(service.createProperty({ ownerId: "owner-1", type: "APARTMENT", addressLine: "Av. Siempre Viva 123" })).rejects.toThrow(
      "No pudimos crear la propiedad"
    );

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(audit.createEntryWithClient).toHaveBeenCalledWith(tx, expect.any(Object), {
      entityType: "property",
      entityId: "property-1",
      action: "property.created",
      metadata: { ownerId: "owner-1" }
    });
  });

  it("rolls back property updates when audit persistence fails", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    vi.mocked(prisma.property.findFirst).mockResolvedValue({ id: "property-1", tenantId: "tenant-d", ownerId: "owner-1" } as never);
    vi.mocked(audit.createEntryWithClient).mockRejectedValue(new Error("audit failed"));
    const tx = { property: { update: vi.fn().mockResolvedValue({ id: "property-1", tenantId: "tenant-d" } as never) } };
    mockTransaction(prisma, tx);
    const service = new PropertiesService(prisma, createContextMock("tenant-d"), audit);

    await expect(service.updateProperty("property-1", { status: "AVAILABLE" })).rejects.toThrow("No pudimos actualizar la propiedad");

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(audit.createEntryWithClient).toHaveBeenCalledWith(tx, expect.any(Object), {
      entityType: "property",
      entityId: "property-1",
      action: "property.updated",
      metadata: { changedFields: ["status"] }
    });
  });

  it("rejects ownership participation when percentages do not total 100 percent", async () => {
    const service = new PropertiesService(createPrismaMock(), createContextMock("tenant-a"), createAuditMock());

    await expect(
      service.updatePropertyOwnership("property-1", [
        { personaId: "persona-1", ownershipShareBps: 6000 },
        { personaId: "persona-2", ownershipShareBps: 3000 }
      ])
    ).rejects.toThrow("Ownership participation must total 100%.");
  });

  it("blocks ownership changes while an active contract references the property", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.property.findFirst).mockResolvedValue({ id: "property-1", tenantId: "tenant-a" } as never);
    vi.mocked(prisma.rentalContract.count).mockResolvedValue(1 as never);
    const service = new PropertiesService(prisma, createContextMock("tenant-a"), createAuditMock());

    await expect(service.updatePropertyOwnership("property-1", [{ personaId: "persona-1", ownershipShareBps: 10000 }])).rejects.toThrow(
      "Ownership cannot be changed while an active contract references the property."
    );

    expect(prisma.rentalContract.count).toHaveBeenCalledWith({ where: { tenantId: "tenant-a", propertyId: "property-1", status: "ACTIVE" } });
  });

  it("persists Persona ownership and service links for a rentable unit", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    vi.mocked(prisma.propertyTypeCatalog.findFirst).mockResolvedValue({ id: "type-apartment", code: "APARTMENT" } as never);
    vi.mocked(prisma.persona.findMany).mockResolvedValue([{ id: "persona-1" }, { id: "persona-2" }] as never);
    vi.mocked(prisma.serviceType.findMany).mockResolvedValue([{ id: "service-gas" }, { id: "service-electricity" }] as never);
    const tx = {
      property: { create: vi.fn().mockResolvedValue({ id: "property-1", tenantId: "tenant-a" } as never) },
      propertyOwner: { createMany: vi.fn().mockResolvedValue({ count: 2 } as never) },
      propertyService: { createMany: vi.fn().mockResolvedValue({ count: 2 } as never) }
    };
    mockTransaction(prisma, tx);
    const service = new PropertiesService(prisma, createContextMock("tenant-a"), audit);

    await service.createPropertyUnit({
      propertyTypeId: "type-apartment",
      addressLine: "Av. Belgrano 100",
      owners: [
        { personaId: "persona-1", ownershipShareBps: 7000 },
        { personaId: "persona-2", ownershipShareBps: 3000 }
      ],
      services: [
        { serviceTypeId: "service-gas", accountNumber: "G-123" },
        { serviceTypeId: "service-electricity" }
      ]
    });

    expect(tx.property.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: "tenant-a", propertyTypeId: "type-apartment", addressLine: "Av. Belgrano 100" })
    });
    expect(tx.propertyOwner.createMany).toHaveBeenCalledWith({
      data: [
        { tenantId: "tenant-a", propertyId: "property-1", personaId: "persona-1", ownershipShareBps: 7000 },
        { tenantId: "tenant-a", propertyId: "property-1", personaId: "persona-2", ownershipShareBps: 3000 }
      ]
    });
    expect(tx.propertyService.createMany).toHaveBeenCalledWith({
      data: [
        { tenantId: "tenant-a", propertyId: "property-1", serviceTypeId: "service-gas", accountNumber: "G-123" },
        { tenantId: "tenant-a", propertyId: "property-1", serviceTypeId: "service-electricity", accountNumber: null }
      ]
    });
  });
});
