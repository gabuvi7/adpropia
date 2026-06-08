import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { AppModule, appModules, protectedRoutes } from "../app.module";
import { CORE_ENTITY_PERMISSIONS, PAYMENTS_PERMISSIONS } from "../common/auth/permissions";
import { REQUIRES_ROLE_KEY } from "../common/auth/roles.decorator";
import { ContractsController } from "./contracts/contracts.controller";
import { IndicesController } from "./indices/indices.controller";
import { IndicesModule } from "./indices/indices.module";
import { LiquidationsController } from "./liquidations/liquidations.controller";
import { PaymentsController } from "./payments/payments.controller";
import { PersonasController } from "./personas/personas.controller";
import { PersonasModule } from "./personas/personas.module";
import { PropertiesController } from "./properties/properties.controller";

describe("Rental API wiring", () => {
  it("registers Persona and Indices modules while preserving legacy owner/renter de-registration", () => {
    const imports: unknown[] = Reflect.getMetadata("imports", AppModule) ?? [];
    const importNames = imports.map((moduleRef) => (typeof moduleRef === "function" ? moduleRef.name : String(moduleRef)));

    expect(appModules.map((moduleRef) => moduleRef.name)).toEqual(expect.arrayContaining(["PersonasModule", "IndicesModule"]));
    expect(importNames).toEqual(expect.arrayContaining(["PersonasModule", "IndicesModule"]));
    expect(importNames).not.toEqual(expect.arrayContaining(["OwnersModule", "RentersModule"]));
  });

  it("protects active Persona and index routes without reintroducing legacy owner/renter routes", () => {
    expect([...protectedRoutes]).toEqual(expect.arrayContaining(["personas", "indices"]));
    expect([...protectedRoutes]).not.toEqual(expect.arrayContaining(["owners", "renters"]));
  });

  it("declares Persona and Indices modules with their controllers", () => {
    expect(Reflect.getMetadata("controllers", PersonasModule)).toEqual([PersonasController]);
    expect(Reflect.getMetadata("controllers", IndicesModule)).toEqual([IndicesController]);
  });

  it("exposes Persona controller role metadata for create/read/list", () => {
    expect(Reflect.getMetadata(REQUIRES_ROLE_KEY, PersonasController.prototype.create)).toEqual([...CORE_ENTITY_PERMISSIONS.create]);
    expect(Reflect.getMetadata(REQUIRES_ROLE_KEY, PersonasController.prototype.list)).toEqual([...CORE_ENTITY_PERMISSIONS.list]);
    expect(Reflect.getMetadata(REQUIRES_ROLE_KEY, PersonasController.prototype.getById)).toEqual([...CORE_ENTITY_PERMISSIONS.read]);
  });

  it("delegates property unit creation and ownership updates to Persona-based service methods", () => {
    const service = {
      createPropertyUnit: vi.fn().mockResolvedValue({ id: "property-1" }),
      updatePropertyOwnership: vi.fn().mockResolvedValue(undefined)
    };
    const controller = new PropertiesController(service as never);

    controller.createUnit({
      propertyTypeId: "type-apartment",
      addressLine: "Av. Siempre Viva 742",
      owners: [{ personaId: "persona-owner-1", ownershipShareBps: 10000 }],
      services: [{ serviceTypeId: "service-electricity", accountNumber: "E-123" }]
    });
    controller.updateOwnership("property-1", { owners: [{ personaId: "persona-owner-2", ownershipShareBps: 10000 }] });

    expect(service.createPropertyUnit).toHaveBeenCalledWith({
      propertyTypeId: "type-apartment",
      addressLine: "Av. Siempre Viva 742",
      owners: [{ personaId: "persona-owner-1", ownershipShareBps: 10000 }],
      services: [{ serviceTypeId: "service-electricity", accountNumber: "E-123" }]
    });
    expect(service.updatePropertyOwnership).toHaveBeenCalledWith("property-1", [{ personaId: "persona-owner-2", ownershipShareBps: 10000 }]);
  });

  it("delegates structured contracts, schedule activation, guarantees, deposits, and early finalization", () => {
    const service = {
      createContractStructure: vi.fn(),
      activateContractSchedule: vi.fn(),
      registerContractGuarantee: vi.fn(),
      defineContractDeposit: vi.fn(),
      finalizeContractEarly: vi.fn()
    };
    const controller = new ContractsController(service as never);

    const structure = {
      participantPersonaIds: ["tenant-persona-1"],
      properties: [{ propertyId: "property-1" }],
      startsAt: "2026-05-01T00:00:00.000Z",
      endsAt: "2027-04-30T00:00:00.000Z",
      monthlyTotalAmount: "100000.00",
      currency: "ARS" as const,
      dueDayOfMonth: 10,
      adjustmentIndexType: "IPC" as const,
      adjustmentPeriodMonths: 1,
      commissionBps: 500
    };
    controller.createStructure(structure);
    controller.activateSchedule("contract-1", { activatedAt: "2026-05-01T00:00:00.000Z", estimatedAmount: "100000.00" });
    controller.registerGuarantee("contract-1", { type: "SURETY", surety: { companyName: "Acme", policyNumber: "P-1" } });
    controller.defineDeposit("contract-1", { amount: "50000.00", currency: "ARS" });
    controller.finalizeEarly("contract-1", { finalizedAt: "2026-10-01T00:00:00.000Z", finalizationReason: "OTHER", finalizationDescription: "Acuerdo" });

    expect(service.createContractStructure).toHaveBeenCalledWith(structure);
    expect(service.activateContractSchedule).toHaveBeenCalledWith("contract-1", { activatedAt: "2026-05-01T00:00:00.000Z", estimatedAmount: "100000.00" });
    expect(service.registerContractGuarantee).toHaveBeenCalledWith("contract-1", { type: "SURETY", surety: { companyName: "Acme", policyNumber: "P-1" } });
    expect(service.defineContractDeposit).toHaveBeenCalledWith("contract-1", { amount: "50000.00", currency: "ARS" });
    expect(service.finalizeContractEarly).toHaveBeenCalledWith("contract-1", { finalizedAt: "2026-10-01T00:00:00.000Z", finalizationReason: "OTHER", finalizationDescription: "Acuerdo" });
  });

  it("delegates rent payment and tenant balance event endpoints without legacy renter IDs", () => {
    const service = { recordRentPayment: vi.fn(), recordTenantBalanceMovement: vi.fn() };
    const controller = new PaymentsController(service as never);

    controller.recordRentPayment({ rentPeriodId: "period-1", amount: "100000.00", currency: "ARS", paidAt: "2026-05-05T12:00:00.000Z" });
    controller.recordTenantBalanceMovement({ rentPeriodId: "period-1", paidAmount: "90000.00", realAmount: "100000.00", currency: "ARS" });

    expect(service.recordRentPayment).toHaveBeenCalledWith({ rentPeriodId: "period-1", amount: "100000.00", currency: "ARS", paidAt: "2026-05-05T12:00:00.000Z" });
    expect(service.recordTenantBalanceMovement).toHaveBeenCalledWith({ rentPeriodId: "period-1", paidAmount: "90000.00", realAmount: "100000.00", currency: "ARS" });
    expect(Reflect.getMetadata(REQUIRES_ROLE_KEY, PaymentsController.prototype.recordRentPayment)).toEqual([...PAYMENTS_PERMISSIONS.create]);
  });

  it("delegates published index persistence and owner settlement input preview", () => {
    const indicesService = { persistPublishedIndex: vi.fn() };
    const indicesController = new IndicesController(indicesService as never);
    const publishedIndex = { source: "ARQUILER" as const, type: "IPC" as const, periodDate: "2026-05-01T00:00:00.000Z", value: "125.250000", publishedAt: "2026-05-17T12:00:00.000Z" };

    indicesController.persistPublishedIndex(publishedIndex);

    expect(indicesService.persistPublishedIndex).toHaveBeenCalledWith({
      source: "ARQUILER",
      type: "IPC",
      periodDate: new Date("2026-05-01T00:00:00.000Z"),
      value: "125.250000",
      publishedAt: new Date("2026-05-17T12:00:00.000Z")
    });

    const liquidationsService = { computeOwnerSettlementInputs: vi.fn() };
    const liquidationsController = new LiquidationsController(liquidationsService as never);
    liquidationsController.computeOwnerSettlementInputs({ contractId: "contract-1", periodStart: "2026-05-01T00:00:00.000Z" });

    expect(liquidationsService.computeOwnerSettlementInputs).toHaveBeenCalledWith({ contractId: "contract-1", periodStart: "2026-05-01T00:00:00.000Z" });
  });
});
