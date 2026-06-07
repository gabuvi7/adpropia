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
    guarantee: {
      create: vi.fn()
    },
    depositPact: {
      create: vi.fn()
    },
    rentPeriod: {
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

  it("rejects incomplete property-backed guarantees with Spanish user-facing validation", async () => {
    const service = new ContractsService(createPrismaMock(), createContextMock("tenant-a"), createAuditMock());

    await expect(
      service.registerContractGuarantee("contract-1", {
        type: "PROPERTY_BACKED",
        state: "ACTIVE",
        propertyBacked: {
          cadastralNomenclature: "Circ. 1 Sec. 2 Manz. 3 Parc. 4",
          registrationNumber: "MAT-12345",
          registrationLocality: "La Plata",
          propertyAddress: "Calle 1 234",
          propertyCity: "La Plata",
          titleHolders: [{ fullName: "María García", taxId: "20-12345678-9", signsGuarantee: false }]
        }
      })
    ).rejects.toThrow("La garantía propietaria debe tener al menos un titular firmante.");
  });

  it("registers multiple simultaneous contract-level guarantees with subtype details and holder signer data", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findUnique).mockResolvedValue({ id: "contract-1", tenantId: "tenant-a" } as never);
    const tx = {
      guarantee: {
        create: vi.fn().mockResolvedValue({ id: "guarantee-1", tenantId: "tenant-a", contractId: "contract-1", type: "PROPERTY_BACKED" } as never)
      }
    };
    vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
      async (callback: (tx: unknown) => unknown) => callback(tx)
    );
    const service = new ContractsService(prisma, createContextMock("tenant-a"), createAuditMock());

    await service.registerContractGuarantee("contract-1", {
      type: "PROPERTY_BACKED",
      state: "ACTIVE",
      propertyBacked: {
        cadastralNomenclature: "Circ. 1 Sec. 2 Manz. 3 Parc. 4",
        registrationNumber: "MAT-12345",
        registrationLocality: "La Plata",
        propertyAddress: "Calle 1 234",
        propertyCity: "La Plata",
        titleHolders: [
          { fullName: "María García", taxId: "20-12345678-9", signsGuarantee: true },
          { fullName: "Juan García", taxId: "20-98765432-1", signsGuarantee: false }
        ]
      }
    });

    expect(tx.guarantee.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-a",
        contractId: "contract-1",
        type: "PROPERTY_BACKED",
        state: "ACTIVE",
        propertyBacked: expect.objectContaining({
          create: expect.objectContaining({ registrationNumber: "MAT-12345", propertyCity: "La Plata" })
        })
      })
    });
    expect(tx.guarantee.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        propertyBacked: expect.objectContaining({
          create: expect.objectContaining({
            titleHolders: {
              createMany: {
                data: [
                  { tenantId: "tenant-a", fullName: "María García", taxId: "20-12345678-9", signsGuarantee: true },
                  { tenantId: "tenant-a", fullName: "Juan García", taxId: "20-98765432-1", signsGuarantee: false }
                ]
              }
            }
          })
        })
      })
    });
  });

  it("keeps deposit pact modeling separate from guarantees and future cash movement/refund flows", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findUnique).mockResolvedValue({ id: "contract-1", tenantId: "tenant-a" } as never);
    const tx = {
      depositPact: {
        create: vi.fn().mockResolvedValue({ id: "deposit-1", tenantId: "tenant-a", contractId: "contract-1" } as never)
      }
    };
    vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
      async (callback: (tx: unknown) => unknown) => callback(tx)
    );
    const service = new ContractsService(prisma, createContextMock("tenant-a"), createAuditMock());

    await service.defineContractDeposit("contract-1", {
      amount: "500000.00",
      currency: "ARS",
      receivedAt: "2026-05-01T00:00:00.000Z",
      notes: "Equivalent to half a monthly rent."
    });

    expect(tx.depositPact.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-a",
        contractId: "contract-1",
        amount: "500000.00",
        currency: "ARS",
        receivedAt: new Date("2026-05-01T00:00:00.000Z"),
        notes: "Equivalent to half a monthly rent.",
        cashMovementId: null,
        refundCashMovementId: null,
        retentionCashMovementId: null
      }
    });
    expect(prisma.guarantee.create).not.toHaveBeenCalled();
  });

  it("activates contracts by generating adjustment-aware estimated monthly rent periods", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findUnique).mockResolvedValue({
      id: "contract-1",
      tenantId: "tenant-a",
      status: "PENDING_SIGNATURE",
      startsAt: new Date("2026-05-01T00:00:00.000Z"),
      endsAt: new Date("2026-07-31T00:00:00.000Z"),
      dueDayOfMonth: 10,
      currency: "ARS",
      monthlyTotalAmount: "100000.00",
      rentAmount: "100000.00",
      adjustmentIndexType: "IPC",
      adjustmentPeriodMonths: 1
    } as never);
    const tx = {
      rentalContract: { update: vi.fn().mockResolvedValue({ id: "contract-1", tenantId: "tenant-a", status: "ACTIVE" } as never) },
      rentPeriod: { createMany: vi.fn().mockResolvedValue({ count: 3 } as never) }
    };
    vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
      async (callback: (tx: unknown) => unknown) => callback(tx)
    );
    const service = new ContractsService(prisma, createContextMock("tenant-a"), createAuditMock());

    await service.activateContractSchedule("contract-1", {
      activatedAt: "2026-05-01T00:00:00.000Z",
      estimatedAmount: "100000.00",
      estimatedIndexValue: "120.500000",
      estimatedIndexSource: "last_known_ipc"
    });

    expect(tx.rentPeriod.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          tenantId: "tenant-a",
          contractId: "contract-1",
          periodStart: new Date("2026-05-01T00:00:00.000Z"),
          periodEnd: new Date("2026-05-31T00:00:00.000Z"),
          dueAt: new Date("2026-05-10T00:00:00.000Z"),
          calculationState: "ESTIMATED",
          estimatedAmount: "100000.00",
          realAmount: null,
          estimatedIndexType: "IPC",
          estimatedIndexValue: "120.500000",
          estimatedIndexSource: "last_known_ipc"
        }),
        expect.objectContaining({ periodStart: new Date("2026-06-01T00:00:00.000Z"), dueAt: new Date("2026-06-10T00:00:00.000Z") }),
        expect.objectContaining({ periodStart: new Date("2026-07-01T00:00:00.000Z"), dueAt: new Date("2026-07-10T00:00:00.000Z") })
      ],
      skipDuplicates: true
    });
    expect(tx.rentalContract.update).toHaveBeenCalledWith({
      where: { id_tenantId: { id: "contract-1", tenantId: "tenant-a" } },
      data: { status: "ACTIVE" }
    });
  });

  it("rejects schedule activation when the contract has no monthly amount", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findUnique).mockResolvedValue({
      id: "contract-1",
      tenantId: "tenant-a",
      startsAt: new Date("2026-05-01T00:00:00.000Z"),
      endsAt: new Date("2026-05-31T00:00:00.000Z"),
      dueDayOfMonth: 10,
      currency: "ARS",
      monthlyTotalAmount: null,
      rentAmount: null,
      adjustmentIndexType: "IPC",
      adjustmentPeriodMonths: 1
    } as never);
    const service = new ContractsService(prisma, createContextMock("tenant-a"), createAuditMock());

    await expect(
      service.activateContractSchedule("contract-1", {
        activatedAt: "2026-05-01T00:00:00.000Z",
        estimatedIndexValue: "120.500000",
        estimatedIndexSource: "last_known_ipc"
      })
    ).rejects.toThrow("El contrato necesita un monto mensual para generar el cronograma de alquiler.");
  });
});
