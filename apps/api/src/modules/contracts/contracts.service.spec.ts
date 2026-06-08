import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../common/prisma";
import type { RequestContextService } from "../../common/request-context/request-context.service";
import type { AuditService } from "../audit/audit.service";
import { ContractsService } from "./contracts.service";

function createPrismaMock() {
  return {
    property: {
      findFirst: vi.fn()
    },
    owner: {
      findFirst: vi.fn()
    },
    renter: {
      findFirst: vi.fn()
    },
    persona: {
      findMany: vi.fn()
    },
    propertyOwner: {
      findMany: vi.fn()
    },
    rentalContract: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
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

const createInput = {
  propertyId: "property-1",
  ownerId: "owner-1",
  renterId: "renter-1",
  startsAt: "2026-05-01T00:00:00.000Z",
  endsAt: "2027-04-30T00:00:00.000Z",
  rentAmount: "100000.00",
  currency: "ARS" as const,
  dueDayOfMonth: 10,
  adjustmentIndexType: "ICL" as const,
  adjustmentPeriodMonths: 3
};

const contractStructureInput = {
  participantPersonaIds: ["tenant-persona-1", "tenant-persona-2"],
  properties: [
    { propertyId: "property-1", monthlyAmount: "600000.00" },
    { propertyId: "property-2", monthlyAmount: "400000.00" }
  ],
  status: "PENDING_SIGNATURE" as const,
  startsAt: "2026-05-01T00:00:00.000Z",
  endsAt: "2027-04-30T00:00:00.000Z",
  monthlyTotalAmount: "1000000.00",
  currency: "ARS" as const,
  dueDayOfMonth: 10,
  adjustmentIndexType: "ICL" as const,
  adjustmentPeriodMonths: 3,
  commissionBps: 500,
  previousContractId: "contract-previous"
};

function mockValidRelations(prisma: PrismaService, tenantId = "tenant-a", ownerId = "owner-1") {
  vi.mocked(prisma.property.findFirst).mockResolvedValue({ id: "property-1", tenantId, ownerId } as never);
  vi.mocked(prisma.owner.findFirst).mockResolvedValue({ id: ownerId, tenantId } as never);
  vi.mocked(prisma.renter.findFirst).mockResolvedValue({ id: "renter-1", tenantId } as never);
}

describe("ContractsService", () => {
  it("checks property, owner, renter and active tenantId before creating contracts", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    mockValidRelations(prisma, "tenant-a");
    const tx = { rentalContract: { create: vi.fn().mockResolvedValue({ id: "contract-1", tenantId: "tenant-a" } as never) } };
    vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
      async (callback: (tx: unknown) => unknown) => callback(tx)
    );
    const service = new ContractsService(prisma, createContextMock("tenant-a"), audit);

    await service.createContract(createInput);

    expect(prisma.property.findFirst).toHaveBeenCalledWith({ where: { id: "property-1", tenantId: "tenant-a", deletedAt: null } });
    expect(prisma.owner.findFirst).toHaveBeenCalledWith({ where: { id: "owner-1", tenantId: "tenant-a", deletedAt: null } });
    expect(prisma.renter.findFirst).toHaveBeenCalledWith({ where: { id: "renter-1", tenantId: "tenant-a", deletedAt: null } });
    expect(tx.rentalContract.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: "tenant-a", propertyId: "property-1", ownerId: "owner-1", renterId: "renter-1" })
    });
  });

  it("rejects contracts when the property does not belong to the selected owner", async () => {
    const prisma = createPrismaMock();
    mockValidRelations(prisma, "tenant-a", "owner-2");
    const service = new ContractsService(prisma, createContextMock("tenant-a"), createAuditMock());

    await expect(service.createContract(createInput)).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.rentalContract.create).not.toHaveBeenCalled();
  });

  it("lists contracts only for the active tenantId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findMany).mockResolvedValue([] as never);
    const service = new ContractsService(prisma, createContextMock("tenant-b"), createAuditMock());

    await service.listContracts();

    expect(prisma.rentalContract.findMany).toHaveBeenCalledWith({ where: { tenantId: "tenant-b" }, orderBy: { startsAt: "desc" } });
  });

  it("lists active contracts only for status ACTIVE and the active tenantId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findMany).mockResolvedValue([] as never);
    const service = new ContractsService(prisma, createContextMock("tenant-c"), createAuditMock());

    await service.listActiveContracts();

    expect(prisma.rentalContract.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-c", status: "ACTIVE" },
      orderBy: { startsAt: "desc" }
    });
  });

  it("gets contracts by id and active tenantId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findUnique).mockResolvedValue({ id: "contract-1", tenantId: "tenant-d" } as never);
    const service = new ContractsService(prisma, createContextMock("tenant-d"), createAuditMock());

    await service.getContractById("contract-1");

    expect(prisma.rentalContract.findUnique).toHaveBeenCalledWith({ where: { id_tenantId: { id: "contract-1", tenantId: "tenant-d" } } });
  });

  it("updates contracts with compound id_tenantId and validates reassigned relations", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const context = createContextMock("tenant-e");
    vi.mocked(prisma.rentalContract.findUnique).mockResolvedValue({
      id: "contract-1",
      tenantId: "tenant-e",
      propertyId: "property-1",
      ownerId: "owner-1",
      renterId: "renter-1"
    } as never);
    mockValidRelations(prisma, "tenant-e", "owner-2");
    const tx = { rentalContract: { update: vi.fn().mockResolvedValue({ id: "contract-1", tenantId: "tenant-e", ownerId: "owner-2" } as never) } };
    vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
      async (callback: (tx: unknown) => unknown) => callback(tx)
    );
    const service = new ContractsService(prisma, context, audit);

    await service.updateContract("contract-1", { ownerId: "owner-2" });

    expect(prisma.property.findFirst).toHaveBeenCalledWith({ where: { id: "property-1", tenantId: "tenant-e", deletedAt: null } });
    expect(prisma.owner.findFirst).toHaveBeenCalledWith({ where: { id: "owner-2", tenantId: "tenant-e", deletedAt: null } });
    expect(tx.rentalContract.update).toHaveBeenCalledWith({
      where: { id_tenantId: { id: "contract-1", tenantId: "tenant-e" } },
      data: { ownerId: "owner-2" }
    });
  });

  it("changes contract status with compound id_tenantId and writes audit", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const tx = { rentalContract: { update: vi.fn().mockResolvedValue({ id: "contract-1", tenantId: "tenant-f", status: "ACTIVE" } as never) } };
    vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
      async (callback: (tx: unknown) => unknown) => callback(tx)
    );
    const service = new ContractsService(prisma, createContextMock("tenant-f"), audit);

    await service.changeContractStatus("contract-1", "ACTIVE");

    expect(tx.rentalContract.update).toHaveBeenCalledWith({
      where: { id_tenantId: { id: "contract-1", tenantId: "tenant-f" } },
      data: { status: "ACTIVE" }
    });
    expect(audit.createEntryWithClient).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ tenantId: "tenant-f" }),
      expect.objectContaining({ action: "contract.status.changed", entityId: "contract-1" })
    );
  });

  it("rejects structured contracts when selected properties have different owner groups", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.property.findFirst)
      .mockResolvedValueOnce({ id: "property-1", tenantId: "tenant-a" } as never)
      .mockResolvedValueOnce({ id: "property-2", tenantId: "tenant-a" } as never);
    vi.mocked(prisma.persona.findMany).mockResolvedValue([{ id: "tenant-persona-1" }, { id: "tenant-persona-2" }] as never);
    vi.mocked(prisma.propertyOwner.findMany)
      .mockResolvedValueOnce([
        { personaId: "owner-a", ownershipShareBps: 7000 },
        { personaId: "owner-b", ownershipShareBps: 3000 }
      ] as never)
      .mockResolvedValueOnce([
        { personaId: "owner-a", ownershipShareBps: 6000 },
        { personaId: "owner-b", ownershipShareBps: 4000 }
      ] as never);
    const service = new ContractsService(prisma, createContextMock("tenant-a"), createAuditMock());

    await expect(service.createContractStructure(contractStructureInput)).rejects.toThrow(
      "Todas las propiedades del contrato deben compartir el mismo grupo de propietarios y porcentajes de titularidad."
    );

    expect(prisma.rentalContract.create).not.toHaveBeenCalled();
  });

  it("creates structured contracts with multiple tenants, multiple properties, lifecycle data, and no tenant liability percentages", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.property.findFirst)
      .mockResolvedValueOnce({ id: "property-1", tenantId: "tenant-a" } as never)
      .mockResolvedValueOnce({ id: "property-2", tenantId: "tenant-a" } as never);
    vi.mocked(prisma.persona.findMany).mockResolvedValue([{ id: "tenant-persona-1" }, { id: "tenant-persona-2" }] as never);
    vi.mocked(prisma.propertyOwner.findMany)
      .mockResolvedValueOnce([
        { personaId: "owner-a", ownershipShareBps: 7000 },
        { personaId: "owner-b", ownershipShareBps: 3000 }
      ] as never)
      .mockResolvedValueOnce([
        { personaId: "owner-a", ownershipShareBps: 7000 },
        { personaId: "owner-b", ownershipShareBps: 3000 }
      ] as never);
    const tx = {
      rentalContract: { create: vi.fn().mockResolvedValue({ id: "contract-1", tenantId: "tenant-a" } as never) },
      contractParticipant: { createMany: vi.fn().mockResolvedValue({ count: 2 } as never) },
      contractProperty: { createMany: vi.fn().mockResolvedValue({ count: 2 } as never) }
    };
    vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
      async (callback: (tx: unknown) => unknown) => callback(tx)
    );
    const audit = createAuditMock();
    const service = new ContractsService(prisma, createContextMock("tenant-a"), audit);

    await service.createContractStructure(contractStructureInput);

    expect(tx.rentalContract.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-a",
        status: "PENDING_SIGNATURE",
        currency: "ARS",
        monthlyTotalAmount: "1000000.00",
        commissionBps: 500,
        previousContractId: "contract-previous"
      })
    });
    expect(tx.contractParticipant.createMany).toHaveBeenCalledWith({
      data: [
        { tenantId: "tenant-a", contractId: "contract-1", personaId: "tenant-persona-1" },
        { tenantId: "tenant-a", contractId: "contract-1", personaId: "tenant-persona-2" }
      ]
    });
    expect(tx.contractProperty.createMany).toHaveBeenCalledWith({
      data: [
        { tenantId: "tenant-a", contractId: "contract-1", propertyId: "property-1", monthlyAmount: "600000.00" },
        { tenantId: "tenant-a", contractId: "contract-1", propertyId: "property-2", monthlyAmount: "400000.00" }
      ]
    });
  });

  it("records early finalization metadata with OTHER reason description", async () => {
    const prisma = createPrismaMock();
    const tx = { rentalContract: { update: vi.fn().mockResolvedValue({ id: "contract-1", tenantId: "tenant-a", status: "FINALIZED" } as never) } };
    vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
      async (callback: (tx: unknown) => unknown) => callback(tx)
    );
    const service = new ContractsService(prisma, createContextMock("tenant-a"), createAuditMock());

    await service.finalizeContractEarly("contract-1", {
      finalizedAt: "2026-10-15T00:00:00.000Z",
      finalizationReason: "OTHER",
      finalizationDescription: "Mutual agreement outside standard reasons."
    });

    expect(tx.rentalContract.update).toHaveBeenCalledWith({
      where: { id_tenantId: { id: "contract-1", tenantId: "tenant-a" } },
      data: {
        status: "FINALIZED",
        finalizedAt: new Date("2026-10-15T00:00:00.000Z"),
        finalizationReason: "OTHER",
        finalizationDescription: "Mutual agreement outside standard reasons."
      }
    });
  });

  it("requires a Spanish user-facing message when finalization reason OTHER has no description", async () => {
    const service = new ContractsService(createPrismaMock(), createContextMock("tenant-a"), createAuditMock());

    await expect(
      service.finalizeContractEarly("contract-1", {
        finalizedAt: "2026-10-15T00:00:00.000Z",
        finalizationReason: "OTHER"
      })
    ).rejects.toThrow("Tenés que indicar una descripción cuando el motivo de finalización es Otro.");
  });
});
