import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../common/prisma";
import type { RequestContextService } from "../../common/request-context/request-context.service";
import { UpcomingAdjustmentsReportService } from "./upcoming-adjustments-report.service";

function createPrismaMock() {
  return {
    rentalContract: {
      findMany: vi.fn()
    }
  } as unknown as PrismaService;
}

function createContextMock(tenantId = "tenant-a") {
  return {
    get: () => ({ requestId: "req-1", userId: "user-1", tenantId, role: "ADMIN" })
  } as RequestContextService;
}

describe("UpcomingAdjustmentsReportService.getUpcomingAdjustments", () => {
  it("lists only active contracts with next adjustment inside range for the active tenant", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findMany).mockResolvedValue([] as never);
    const service = new UpcomingAdjustmentsReportService(prisma, createContextMock("tenant-b"));

    await service.getUpcomingAdjustments({
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-31T23:59:59.999Z",
      contractId: "contract-1",
      renterId: "renter-1",
      propertyId: "property-1"
    });

    expect(prisma.rentalContract.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-b",
        status: "ACTIVE",
        nextAdjustmentAt: { gte: new Date("2026-08-01T00:00:00.000Z"), lte: new Date("2026-08-31T23:59:59.999Z") },
        id: "contract-1",
        renterId: "renter-1",
        propertyId: "property-1"
      },
      include: expect.any(Object),
      orderBy: { nextAdjustmentAt: "asc" }
    });
  });

  it("shows current and adjusted amounts with applied index and period", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findMany).mockResolvedValue([
      {
        id: "contract-1",
        propertyId: "property-1",
        renterId: "renter-1",
        ownerId: "owner-1",
        currency: "ARS",
        nextAdjustmentAt: new Date("2026-08-10T00:00:00.000Z"),
        adjustmentIndexType: "IPC",
        monthlyTotalAmount: "100000.00",
        rentAmount: "100000.00",
        property: { addressLine: "Av. Siempre Viva 742" },
        renter: { displayName: "Inquilino Uno" },
        rentPeriods: [
          {
            id: "period-previous",
            periodStart: new Date("2026-07-01T00:00:00.000Z"),
            estimatedAmount: "100000.00",
            realAmount: null,
            estimatedIndexType: "IPC",
            estimatedIndexValue: "10.000000",
            estimatedIndexSource: "MANUAL",
            realIndexValue: null,
            realIndexSource: null,
            contractAdjustments: []
          },
          {
            id: "period-adjusted",
            periodStart: new Date("2026-08-01T00:00:00.000Z"),
            estimatedAmount: "112000.00",
            realAmount: "113000.00",
            estimatedIndexType: "IPC",
            estimatedIndexValue: "12.000000",
            estimatedIndexSource: "MANUAL",
            realIndexValue: "13.000000",
            realIndexSource: "ARQUILER",
            contractAdjustments: [
              {
                source: "ARQUILER",
                realIndexValue: "13.000000",
                realAmount: "113000.00",
                estimatedAmount: "112000.00",
                economicIndexValue: {
                  periodDate: new Date("2026-08-01T00:00:00.000Z"),
                  value: "13.000000",
                  source: "ARQUILER"
                }
              }
            ]
          }
        ]
      }
    ] as never);
    const service = new UpcomingAdjustmentsReportService(prisma, createContextMock("tenant-a"));

    const result = await service.getUpcomingAdjustments({ from: "2026-08-01T00:00:00.000Z", to: "2026-08-31T23:59:59.999Z" });

    expect(result.total).toBe(1);
    expect(result.items[0]).toEqual({
      contractId: "contract-1",
      propertyId: "property-1",
      renterId: "renter-1",
      ownerId: "owner-1",
      renterName: "Inquilino Uno",
      propertyAddress: "Av. Siempre Viva 742",
      currency: "ARS",
      adjustmentDate: new Date("2026-08-10T00:00:00.000Z"),
      currentAmount: "100000.00",
      adjustedAmount: "113000.00",
      index: {
        type: "IPC",
        source: "ARQUILER",
        value: "13.000000",
        period: "2026-08",
        status: "AVAILABLE",
        message: null
      }
    });
  });

  it("returns a Spanish public message when the adjustment index value is missing", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findMany).mockResolvedValue([
      {
        id: "contract-2",
        propertyId: null,
        renterId: null,
        ownerId: null,
        currency: "ARS",
        nextAdjustmentAt: new Date("2026-09-01T00:00:00.000Z"),
        adjustmentIndexType: "ICL",
        monthlyTotalAmount: null,
        rentAmount: "90000.00",
        property: null,
        renter: null,
        rentPeriods: [
          {
            id: "period-adjusted",
            periodStart: new Date("2026-09-01T00:00:00.000Z"),
            estimatedAmount: "90000.00",
            realAmount: null,
            estimatedIndexType: "ICL",
            estimatedIndexValue: null,
            estimatedIndexSource: null,
            realIndexValue: null,
            realIndexSource: null,
            contractAdjustments: []
          }
        ]
      }
    ] as never);
    const service = new UpcomingAdjustmentsReportService(prisma, createContextMock("tenant-a"));

    const result = await service.getUpcomingAdjustments({ from: "2026-09-01T00:00:00.000Z", to: "2026-09-30T23:59:59.999Z" });

    expect(result.items[0]!.currentAmount).toBe("90000.00");
    expect(result.items[0]!.adjustedAmount).toBe("90000.00");
    expect(result.items[0]!.index).toEqual({
      type: "ICL",
      source: null,
      value: null,
      period: "2026-09",
      status: "MISSING",
      message: "Falta cargar el valor del índice para el período de ajuste."
    });
  });

  it("rejects invalid date ranges", async () => {
    const prisma = createPrismaMock();
    const service = new UpcomingAdjustmentsReportService(prisma, createContextMock("tenant-a"));

    await expect(
      service.getUpcomingAdjustments({ from: "2026-10-31T00:00:00.000Z", to: "2026-10-01T00:00:00.000Z" })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.rentalContract.findMany).not.toHaveBeenCalled();
  });
});
