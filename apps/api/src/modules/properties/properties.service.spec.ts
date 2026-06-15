import { BadRequestException, NotFoundException } from "@nestjs/common";
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

const activeContractStatusInclude = {
  contracts: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 },
  contractProperties: { where: { contract: { status: "ACTIVE" } }, select: { id: true }, take: 1 }
};

function mockTransaction(prisma: PrismaService, tx: unknown) {
  vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
    async (callback: (tx: unknown) => unknown) => callback(tx)
  );
}

async function expectHttpException(
  promise: Promise<unknown>,
  exceptionClass: typeof BadRequestException | typeof NotFoundException,
  statusCode: number,
  message: string
) {
  await expect(promise).rejects.toBeInstanceOf(exceptionClass);
  await expect(promise).rejects.toMatchObject({
    response: expect.objectContaining({ statusCode, message })
  });
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
      data: { tenantId: "tenant-a", ownerId: "owner-1", type: "APARTMENT", addressLine: "Av. Siempre Viva 123" }
    });
    expect(audit.createEntryWithClient).toHaveBeenCalledWith(tx, expect.objectContaining({ tenantId: "tenant-a" }), {
      entityType: "property",
      entityId: "property-1",
      action: "property.created",
      metadata: { ownerId: "owner-1" }
    });
  });

  it("persists provided property creation fields and omits fields not provided", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.owner.findFirst).mockResolvedValue({ id: "owner-1", tenantId: "tenant-a" } as never);
    const tx = { property: { create: vi.fn().mockResolvedValue({ id: "property-1", tenantId: "tenant-a", ownerId: "owner-1" } as never) } };
    mockTransaction(prisma, tx);
    const service = new PropertiesService(prisma, createContextMock("tenant-a"), createAuditMock());

    await service.createProperty({
      ownerId: "owner-1",
      type: "HOUSE",
      status: "RENTED",
      addressLine: "Av. Pellegrini 1500",
      city: "Rosario",
      province: "Santa Fe",
      postalCode: "2000",
      commissionBps: 450
    });

    expect(tx.property.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-a",
        ownerId: "owner-1",
        type: "HOUSE",
        status: "RENTED",
        addressLine: "Av. Pellegrini 1500",
        city: "Rosario",
        province: "Santa Fe",
        postalCode: "2000",
        commissionBps: 450
      }
    });
  });

  it("lists properties only for the active tenantId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.property.findMany).mockResolvedValue([] as never);
    const service = new PropertiesService(prisma, createContextMock("tenant-b"), createAuditMock());

    await service.listProperties();

    expect(prisma.property.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-b", deletedAt: null },
      orderBy: { addressLine: "asc" },
      include: activeContractStatusInclude
    });
  });

  it("returns rented status for listed properties with an active contract", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.property.findMany).mockResolvedValue([
      {
        id: "property-1",
        tenantId: "tenant-b",
        status: "AVAILABLE",
        contracts: [{ id: "contract-1" }],
        contractProperties: []
      },
      {
        id: "property-2",
        tenantId: "tenant-b",
        status: "INACTIVE",
        contracts: [],
        contractProperties: [{ id: "contract-property-1" }]
      },
      { id: "property-3", tenantId: "tenant-b", status: "AVAILABLE", contracts: [], contractProperties: [] }
    ] as never);
    const service = new PropertiesService(prisma, createContextMock("tenant-b"), createAuditMock());

    await expect(service.listProperties()).resolves.toEqual([
      expect.objectContaining({ id: "property-1", status: "RENTED" }),
      expect.objectContaining({ id: "property-2", status: "RENTED" }),
      expect.objectContaining({ id: "property-3", status: "AVAILABLE" })
    ]);
  });

  it("does not return rented status when active contract relations are absent", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.property.findMany).mockResolvedValue([
      {
        id: "property-1",
        tenantId: "tenant-b",
        status: "AVAILABLE",
        contracts: [],
        contractProperties: []
      }
    ] as never);
    const service = new PropertiesService(prisma, createContextMock("tenant-b"), createAuditMock());

    await expect(service.listProperties()).resolves.toEqual([expect.objectContaining({ id: "property-1", status: "AVAILABLE" })]);
  });

  it("gets properties by id and active tenantId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.property.findFirst).mockResolvedValue({ id: "property-1", tenantId: "tenant-c" } as never);
    const service = new PropertiesService(prisma, createContextMock("tenant-c"), createAuditMock());

    await service.getPropertyById("property-1");

    expect(prisma.property.findFirst).toHaveBeenCalledWith({ where: { id: "property-1", tenantId: "tenant-c", deletedAt: null }, include: activeContractStatusInclude });
  });

  it("returns rented status for a requested property with an active contract", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.property.findFirst).mockResolvedValue({
      id: "property-1",
      tenantId: "tenant-c",
      status: "AVAILABLE",
      contracts: [],
      contractProperties: [{ id: "contract-property-1" }]
    } as never);
    const service = new PropertiesService(prisma, createContextMock("tenant-c"), createAuditMock());

    await expect(service.getPropertyById("property-1")).resolves.toEqual(expect.objectContaining({ status: "RENTED" }));
  });

  it("throws NotFound when the requested property is missing for the active tenant", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.property.findFirst).mockResolvedValue(null as never);
    const service = new PropertiesService(prisma, createContextMock("tenant-c"), createAuditMock());

    await expectHttpException(service.getPropertyById("property-1"), NotFoundException, 404, "No encontramos la propiedad solicitada.");

    expect(prisma.property.findFirst).toHaveBeenCalledWith({ where: { id: "property-1", tenantId: "tenant-c", deletedAt: null }, include: activeContractStatusInclude });
  });

  it("finds tenant-scoped properties through the compatibility lookup", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.property.findFirst).mockResolvedValue({ id: "property-1", tenantId: "tenant-scope" } as never);
    const service = new PropertiesService(prisma, createContextMock("tenant-scope"), createAuditMock());

    await expect(service.findPropertyForTenant("property-1")).resolves.toEqual({ id: "property-1", tenantId: "tenant-scope" });

    expect(prisma.property.findFirst).toHaveBeenCalledWith({ where: { id: "property-1", tenantId: "tenant-scope", deletedAt: null }, include: activeContractStatusInclude });
  });

  it("rejects property creation when the owner is missing, inactive, or from another tenant", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.owner.findFirst).mockResolvedValue(null as never);
    const service = new PropertiesService(prisma, createContextMock("tenant-a"), createAuditMock());

    await expectHttpException(
      service.createProperty({ ownerId: "owner-other", type: "APARTMENT", addressLine: "Av. Siempre Viva 123" }),
      BadRequestException,
      400,
      "El propietario indicado no existe en esta inmobiliaria."
    );

    expect(prisma.owner.findFirst).toHaveBeenCalledWith({ where: { id: "owner-other", tenantId: "tenant-a", deletedAt: null } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("updates properties with compound id_tenantId after checking active tenantId", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    vi.mocked(prisma.property.findFirst).mockResolvedValue({ id: "property-1", tenantId: "tenant-d", ownerId: "owner-1" } as never);
    const tx = { property: { update: vi.fn().mockResolvedValue({ id: "property-1", tenantId: "tenant-d", addressLine: "Nueva dirección" } as never) } };
    mockTransaction(prisma, tx);
    const service = new PropertiesService(prisma, createContextMock("tenant-d"), audit);

    await service.updateProperty("property-1", { addressLine: "Nueva dirección" });

    expect(prisma.property.findFirst).toHaveBeenCalledWith({ where: { id: "property-1", tenantId: "tenant-d", deletedAt: null }, include: activeContractStatusInclude });
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

  it("throws NotFound before updating when the property is not active for the tenant", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.property.findFirst).mockResolvedValue(null as never);
    const service = new PropertiesService(prisma, createContextMock("tenant-d"), createAuditMock());

    await expectHttpException(
      service.updateProperty("property-missing", { addressLine: "Nueva dirección" }),
      NotFoundException,
      404,
      "No encontramos la propiedad solicitada."
    );

    expect(prisma.property.findFirst).toHaveBeenCalledWith({ where: { id: "property-missing", tenantId: "tenant-d", deletedAt: null }, include: activeContractStatusInclude });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("persists provided property update fields and omits fields not provided", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.property.findFirst).mockResolvedValue({ id: "property-1", tenantId: "tenant-d", ownerId: "owner-1" } as never);
    const tx = { property: { update: vi.fn().mockResolvedValue({ id: "property-1", tenantId: "tenant-d" } as never) } };
    mockTransaction(prisma, tx);
    const service = new PropertiesService(prisma, createContextMock("tenant-d"), createAuditMock());

    await service.updateProperty("property-1", {
      type: "HOUSE",
      status: "RENTED",
      city: "Rosario",
      province: "Santa Fe",
      postalCode: "2000",
      commissionBps: 550
    });

    expect(tx.property.update).toHaveBeenCalledWith({
      where: { id_tenantId: { id: "property-1", tenantId: "tenant-d" } },
      data: { type: "HOUSE", status: "RENTED", city: "Rosario", province: "Santa Fe", postalCode: "2000", commissionBps: 550 }
    });
  });

  it("audits operational property status changes", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    vi.mocked(prisma.property.findFirst).mockResolvedValue({ id: "property-1", tenantId: "tenant-d", status: "AVAILABLE" } as never);
    const tx = { property: { update: vi.fn().mockResolvedValue({ id: "property-1", tenantId: "tenant-d", status: "INACTIVE" } as never) } };
    mockTransaction(prisma, tx);
    const service = new PropertiesService(prisma, createContextMock("tenant-d"), audit);

    await service.updateProperty("property-1", { status: "INACTIVE" });

    expect(audit.createEntryWithClient).toHaveBeenCalledWith(tx, expect.objectContaining({ tenantId: "tenant-d" }), {
      entityType: "property",
      entityId: "property-1",
      action: "property.status.changed",
      metadata: { from: "AVAILABLE", to: "INACTIVE" }
    });
  });

  it("does not emit status change audit when the status stays the same", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    vi.mocked(prisma.property.findFirst).mockResolvedValue({ id: "property-1", tenantId: "tenant-d", status: "AVAILABLE" } as never);
    const tx = { property: { update: vi.fn().mockResolvedValue({ id: "property-1", tenantId: "tenant-d", status: "AVAILABLE" } as never) } };
    mockTransaction(prisma, tx);
    const service = new PropertiesService(prisma, createContextMock("tenant-d"), audit);

    await service.updateProperty("property-1", { status: "AVAILABLE" });

    expect(audit.createEntryWithClient).not.toHaveBeenCalledWith(tx, expect.any(Object), expect.objectContaining({ action: "property.status.changed" }));
  });

  it("does not audit persisted status changes when an active contract keeps the operational status rented", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    vi.mocked(prisma.property.findFirst).mockResolvedValue({
      id: "property-1",
      tenantId: "tenant-d",
      status: "AVAILABLE",
      contracts: [{ id: "contract-1" }],
      contractProperties: []
    } as never);
    const tx = { property: { update: vi.fn().mockResolvedValue({ id: "property-1", tenantId: "tenant-d", status: "INACTIVE" } as never) } };
    mockTransaction(prisma, tx);
    const service = new PropertiesService(prisma, createContextMock("tenant-d"), audit);

    await expect(service.updateProperty("property-1", { status: "INACTIVE" })).resolves.toEqual(expect.objectContaining({ status: "RENTED" }));

    expect(audit.createEntryWithClient).not.toHaveBeenCalledWith(tx, expect.any(Object), expect.objectContaining({ action: "property.status.changed" }));
  });

  it("does not audit setting persisted status to rented when the operational status was already rented", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    vi.mocked(prisma.property.findFirst).mockResolvedValue({
      id: "property-1",
      tenantId: "tenant-d",
      status: "AVAILABLE",
      contracts: [],
      contractProperties: [{ id: "contract-property-1" }]
    } as never);
    const tx = { property: { update: vi.fn().mockResolvedValue({ id: "property-1", tenantId: "tenant-d", status: "RENTED" } as never) } };
    mockTransaction(prisma, tx);
    const service = new PropertiesService(prisma, createContextMock("tenant-d"), audit);

    await expect(service.updateProperty("property-1", { status: "RENTED" })).resolves.toEqual(expect.objectContaining({ status: "RENTED" }));

    expect(audit.createEntryWithClient).not.toHaveBeenCalledWith(tx, expect.any(Object), expect.objectContaining({ action: "property.status.changed" }));
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
    ).rejects.toThrow("La participación de los propietarios debe sumar 100%.");
  });

  it("rejects ownership participation when no owners are provided", async () => {
    const service = new PropertiesService(createPrismaMock(), createContextMock("tenant-a"), createAuditMock());

    await expectHttpException(
      service.updatePropertyOwnership("property-1", []),
      BadRequestException,
      400,
      "La participación de los propietarios debe sumar 100%."
    );
  });

  it("blocks ownership changes while an active contract references the property", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.property.findFirst).mockResolvedValue({ id: "property-1", tenantId: "tenant-a" } as never);
    vi.mocked(prisma.rentalContract.count).mockResolvedValue(1 as never);
    const service = new PropertiesService(prisma, createContextMock("tenant-a"), createAuditMock());

    await expect(service.updatePropertyOwnership("property-1", [{ personaId: "persona-1", ownershipShareBps: 10000 }])).rejects.toThrow(
      "No podés cambiar la titularidad mientras haya un contrato activo asociado a la propiedad."
    );

    expect(prisma.rentalContract.count).toHaveBeenCalledWith({ where: { tenantId: "tenant-a", propertyId: "property-1", status: "ACTIVE" } });
  });

  it("throws NotFound before changing ownership when the property is not active for the tenant", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.property.findFirst).mockResolvedValue(null as never);
    const service = new PropertiesService(prisma, createContextMock("tenant-a"), createAuditMock());

    await expectHttpException(
      service.updatePropertyOwnership("property-missing", [{ personaId: "persona-1", ownershipShareBps: 10000 }]),
      NotFoundException,
      404,
      "No encontramos la propiedad solicitada."
    );

    expect(prisma.property.findFirst).toHaveBeenCalledWith({ where: { id: "property-missing", tenantId: "tenant-a", deletedAt: null }, include: activeContractStatusInclude });
    expect(prisma.rentalContract.count).not.toHaveBeenCalled();
  });

  it("replaces ownership in a transaction and audits the new owners", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    vi.mocked(prisma.property.findFirst).mockResolvedValue({ id: "property-1", tenantId: "tenant-a" } as never);
    vi.mocked(prisma.rentalContract.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.persona.findMany).mockResolvedValue([{ id: "persona-1" }, { id: "persona-2" }] as never);
    const tx = {
      propertyOwner: {
        deleteMany: vi.fn().mockResolvedValue({ count: 2 } as never),
        createMany: vi.fn().mockResolvedValue({ count: 2 } as never)
      }
    };
    mockTransaction(prisma, tx);
    const service = new PropertiesService(prisma, createContextMock("tenant-a"), audit);

    await service.updatePropertyOwnership("property-1", [
      { personaId: "persona-1", ownershipShareBps: 6000 },
      { personaId: "persona-2", ownershipShareBps: 4000 }
    ]);

    expect(prisma.rentalContract.count).toHaveBeenCalledWith({ where: { tenantId: "tenant-a", propertyId: "property-1", status: "ACTIVE" } });
    expect(prisma.persona.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-a", id: { in: ["persona-1", "persona-2"] }, deletedAt: null },
      select: { id: true }
    });
    expect(tx.propertyOwner.deleteMany).toHaveBeenCalledWith({ where: { tenantId: "tenant-a", propertyId: "property-1" } });
    expect(tx.propertyOwner.createMany).toHaveBeenCalledWith({
      data: [
        { tenantId: "tenant-a", propertyId: "property-1", personaId: "persona-1", ownershipShareBps: 6000 },
        { tenantId: "tenant-a", propertyId: "property-1", personaId: "persona-2", ownershipShareBps: 4000 }
      ]
    });
    expect(audit.createEntryWithClient).toHaveBeenCalledWith(tx, expect.objectContaining({ tenantId: "tenant-a" }), {
      entityType: "property",
      entityId: "property-1",
      action: "property.ownership_updated",
      metadata: { ownerPersonaIds: ["persona-1", "persona-2"] }
    });
  });

  it("wraps ownership transaction failures in the public Spanish BadRequest message", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.property.findFirst).mockResolvedValue({ id: "property-1", tenantId: "tenant-a" } as never);
    vi.mocked(prisma.rentalContract.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.persona.findMany).mockResolvedValue([{ id: "persona-1" }] as never);
    const tx = {
      propertyOwner: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 } as never),
        createMany: vi.fn().mockRejectedValue(new Error("database failed"))
      }
    };
    mockTransaction(prisma, tx);
    const service = new PropertiesService(prisma, createContextMock("tenant-a"), createAuditMock());

    await expectHttpException(
      service.updatePropertyOwnership("property-1", [{ personaId: "persona-1", ownershipShareBps: 10000 }]),
      BadRequestException,
      400,
      "No pudimos actualizar los propietarios de la propiedad. Revisá los datos enviados."
    );

    expect(prisma.$transaction).toHaveBeenCalledOnce();
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
      status: "AVAILABLE",
      buildingName: "Torre Norte",
      city: "Córdoba",
      province: "Córdoba",
      postalCode: "5000",
      commissionBps: 650,
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
      data: {
        tenantId: "tenant-a",
        propertyTypeId: "type-apartment",
        type: "APARTMENT",
        addressLine: "Av. Belgrano 100",
        status: "AVAILABLE",
        buildingName: "Torre Norte",
        city: "Córdoba",
        province: "Córdoba",
        postalCode: "5000",
        commissionBps: 650
      }
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
    expect(audit.createEntryWithClient).toHaveBeenCalledWith(tx, expect.objectContaining({ tenantId: "tenant-a" }), {
      entityType: "property",
      entityId: "property-1",
      action: "property.created",
      metadata: { ownerPersonaIds: ["persona-1", "persona-2"], serviceTypeIds: ["service-gas", "service-electricity"] }
    });
  });

  it("does not create service links when a unit has no services", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    vi.mocked(prisma.propertyTypeCatalog.findFirst).mockResolvedValue({ id: "type-house", code: "HOUSE" } as never);
    vi.mocked(prisma.persona.findMany).mockResolvedValue([{ id: "persona-1" }] as never);
    const tx = {
      property: { create: vi.fn().mockResolvedValue({ id: "property-1", tenantId: "tenant-a" } as never) },
      propertyOwner: { createMany: vi.fn().mockResolvedValue({ count: 1 } as never) },
      propertyService: { createMany: vi.fn() }
    };
    mockTransaction(prisma, tx);
    const service = new PropertiesService(prisma, createContextMock("tenant-a"), audit);

    await service.createPropertyUnit({
      propertyTypeId: "type-house",
      addressLine: "San Martín 42",
      owners: [{ personaId: "persona-1", ownershipShareBps: 10000 }]
    });

    expect(prisma.serviceType.findMany).not.toHaveBeenCalled();
    expect(tx.property.create).toHaveBeenCalledWith({
      data: { tenantId: "tenant-a", propertyTypeId: "type-house", type: "HOUSE", addressLine: "San Martín 42" }
    });
    expect(tx.propertyService.createMany).not.toHaveBeenCalled();
    expect(audit.createEntryWithClient).toHaveBeenCalledWith(tx, expect.objectContaining({ tenantId: "tenant-a" }), {
      entityType: "property",
      entityId: "property-1",
      action: "property.created",
      metadata: { ownerPersonaIds: ["persona-1"], serviceTypeIds: [] }
    });
  });

  it("rejects units when the property type is missing, inactive, or has an unsupported code", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.propertyTypeCatalog.findFirst).mockResolvedValue(null as never);
    const service = new PropertiesService(prisma, createContextMock("tenant-a"), createAuditMock());

    await expectHttpException(
      service.createPropertyUnit({
        propertyTypeId: "type-missing",
        addressLine: "San Martín 42",
        owners: [{ personaId: "persona-1", ownershipShareBps: 10000 }]
      }),
      BadRequestException,
      400,
      "El tipo de propiedad indicado no existe."
    );

    expect(prisma.propertyTypeCatalog.findFirst).toHaveBeenCalledWith({ where: { id: "type-missing", isActive: true }, select: { code: true } });
    expect(prisma.persona.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects units when the property type catalog code is unsupported", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.propertyTypeCatalog.findFirst).mockResolvedValue({ code: "WAREHOUSE" } as never);
    const service = new PropertiesService(prisma, createContextMock("tenant-a"), createAuditMock());

    await expectHttpException(
      service.createPropertyUnit({
        propertyTypeId: "type-unsupported",
        addressLine: "San Martín 42",
        owners: [{ personaId: "persona-1", ownershipShareBps: 10000 }]
      }),
      BadRequestException,
      400,
      "El tipo de propiedad indicado no existe."
    );

    expect(prisma.persona.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects units when an owner persona is inactive, missing, or from another tenant", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.propertyTypeCatalog.findFirst).mockResolvedValue({ code: "APARTMENT" } as never);
    vi.mocked(prisma.persona.findMany).mockResolvedValue([{ id: "persona-1" }] as never);
    const service = new PropertiesService(prisma, createContextMock("tenant-a"), createAuditMock());

    await expectHttpException(
      service.createPropertyUnit({
        propertyTypeId: "type-apartment",
        addressLine: "San Martín 42",
        owners: [
          { personaId: "persona-1", ownershipShareBps: 5000 },
          { personaId: "persona-other", ownershipShareBps: 5000 }
        ]
      }),
      BadRequestException,
      400,
      "Todos los propietarios deben pertenecer a esta inmobiliaria."
    );

    expect(prisma.persona.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-a", id: { in: ["persona-1", "persona-other"] }, deletedAt: null },
      select: { id: true }
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects units when a service type is missing or inactive", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.propertyTypeCatalog.findFirst).mockResolvedValue({ code: "APARTMENT" } as never);
    vi.mocked(prisma.persona.findMany).mockResolvedValue([{ id: "persona-1" }] as never);
    vi.mocked(prisma.serviceType.findMany).mockResolvedValue([{ id: "service-gas" }] as never);
    const service = new PropertiesService(prisma, createContextMock("tenant-a"), createAuditMock());

    await expectHttpException(
      service.createPropertyUnit({
        propertyTypeId: "type-apartment",
        addressLine: "San Martín 42",
        owners: [{ personaId: "persona-1", ownershipShareBps: 10000 }],
        services: [{ serviceTypeId: "service-gas" }, { serviceTypeId: "service-missing" }]
      }),
      BadRequestException,
      400,
      "Todos los servicios indicados deben existir en el catálogo global."
    );

    expect(prisma.serviceType.findMany).toHaveBeenCalledWith({ where: { id: { in: ["service-gas", "service-missing"] }, isActive: true }, select: { id: true } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("wraps unit creation transaction failures in the public Spanish BadRequest message", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    vi.mocked(prisma.propertyTypeCatalog.findFirst).mockResolvedValue({ code: "APARTMENT" } as never);
    vi.mocked(prisma.persona.findMany).mockResolvedValue([{ id: "persona-1" }] as never);
    vi.mocked(audit.createEntryWithClient).mockRejectedValue(new Error("audit failed"));
    const tx = {
      property: { create: vi.fn().mockResolvedValue({ id: "property-1", tenantId: "tenant-a" } as never) },
      propertyOwner: { createMany: vi.fn().mockResolvedValue({ count: 1 } as never) },
      propertyService: { createMany: vi.fn() }
    };
    mockTransaction(prisma, tx);
    const service = new PropertiesService(prisma, createContextMock("tenant-a"), audit);

    await expectHttpException(
      service.createPropertyUnit({
        propertyTypeId: "type-apartment",
        addressLine: "San Martín 42",
        owners: [{ personaId: "persona-1", ownershipShareBps: 10000 }]
      }),
      BadRequestException,
      400,
      "No pudimos crear la unidad funcional. Revisá los datos enviados."
    );

    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });
});
