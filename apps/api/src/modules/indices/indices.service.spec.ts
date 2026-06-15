import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../common/prisma";
import type { RequestContextService } from "../../common/request-context/request-context.service";
import { INDEX_PROVIDER_PRIORITY, IndicesService, type IndexProviderAdapter } from "./indices.service";

type TxClient = {
  customIndexValue: { upsert: ReturnType<typeof vi.fn> };
  contractAdjustment: { createMany: ReturnType<typeof vi.fn> };
};

function createPrismaMock() {
  const tx: TxClient = {
    customIndexValue: { upsert: vi.fn() },
    contractAdjustment: { createMany: vi.fn() }
  };

  const prisma = {
    economicIndex: {
      findUnique: vi.fn()
    },
    rentPeriod: {
      findMany: vi.fn()
    },
    customIndexValue: {
      findFirst: vi.fn()
    },
    $transaction: vi.fn(async (fn: (client: TxClient) => unknown) => fn(tx))
  } as unknown as PrismaService & { __tx: TxClient };

  prisma.__tx = tx;
  return prisma;
}

function createContextMock(tenantId = "tenant-a") {
  return {
    get: () => ({ requestId: "req-1", userId: "user-1", tenantId, role: "ADMIN" })
  } as RequestContextService;
}

function createProvider(source: IndexProviderAdapter["source"], value: string | null): IndexProviderAdapter {
  return {
    source,
    fetchPublishedIndex: vi.fn().mockResolvedValue(
      value === null
        ? null
        : {
            type: "IPC",
            periodDate: new Date("2026-05-01T00:00:00.000Z"),
            value,
            publishedAt: new Date("2026-05-17T12:00:00.000Z")
          }
    )
  };
}

describe("IndicesService.persistPublishedIndex", () => {
  it("persists provider index values idempotently and creates reconciliation trace inputs for estimated periods", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.economicIndex.findUnique).mockResolvedValue({ id: "economic-index-ipc", type: "IPC", name: "IPC", source: "ARQUILER" } as never);
    vi.mocked(prisma.rentPeriod.findMany).mockResolvedValue([
      {
        id: "period-1",
        tenantId: "tenant-a",
        contractId: "contract-1",
        estimatedAmount: "100000.00",
        estimatedIndexValue: "120.500000",
        estimatedIndexSource: "last_known_ipc",
        periodStart: new Date("2026-05-01T00:00:00.000Z")
      }
    ] as never);
    prisma.__tx.customIndexValue.upsert.mockResolvedValue({ id: "index-value-1", tenantId: "tenant-a", value: "125.250000" });
    const service = new IndicesService(prisma, createContextMock("tenant-a"));

    await service.persistPublishedIndex({
      source: "ARQUILER",
      type: "IPC",
      periodDate: new Date("2026-05-01T00:00:00.000Z"),
      value: "125.250000",
      publishedAt: new Date("2026-05-17T12:00:00.000Z")
    });

    expect(prisma.__tx.customIndexValue.upsert).toHaveBeenCalledWith({
      where: { tenantId_idempotencyKey: { tenantId: "tenant-a", idempotencyKey: "IPC:2026-05" } },
      create: expect.objectContaining({
        tenantId: "tenant-a",
        economicIndexId: "economic-index-ipc",
        periodDate: new Date("2026-05-01T00:00:00.000Z"),
        value: "125.250000",
        isManual: false,
        source: "ARQUILER",
        idempotencyKey: "IPC:2026-05",
        publishedAt: new Date("2026-05-17T12:00:00.000Z")
      }),
      update: expect.objectContaining({ value: "125.250000", publishedAt: new Date("2026-05-17T12:00:00.000Z") })
    });
    expect(prisma.rentPeriod.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-a",
        calculationState: "ESTIMATED",
        estimatedIndexType: "IPC",
        periodStart: new Date("2026-05-01T00:00:00.000Z")
      },
      select: expect.objectContaining({ id: true, contractId: true, estimatedAmount: true, estimatedIndexValue: true, estimatedIndexSource: true })
    });
    expect(prisma.__tx.contractAdjustment.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          tenantId: "tenant-a",
          contractId: "contract-1",
          rentPeriodId: "period-1",
          economicIndexValueId: "index-value-1",
          source: "ARQUILER",
          type: "IPC",
          state: "PENDING_RECONCILIATION",
          estimatedAmount: "100000.00",
          estimatedIndexValue: "120.500000",
          realIndexValue: "125.250000"
        })
      ],
      skipDuplicates: true
    });
  });

  it("keeps duplicate provider/date persistence idempotent for any day in the period month", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.economicIndex.findUnique).mockResolvedValue({ id: "economic-index-ipc", type: "IPC", name: "IPC", source: "ARQUILER" } as never);
    vi.mocked(prisma.rentPeriod.findMany).mockResolvedValue([] as never);
    prisma.__tx.customIndexValue.upsert.mockResolvedValue({ id: "index-value-1", tenantId: "tenant-a", value: "125.250000" });
    const service = new IndicesService(prisma, createContextMock("tenant-a"));
    const input = {
      source: "ARQUILER" as const,
      type: "IPC" as const,
      periodDate: new Date("2026-05-19T21:45:00.000Z"),
      value: "125.250000",
      publishedAt: new Date("2026-05-19T21:45:00.000Z")
    };

    await service.persistPublishedIndex(input);
    await service.persistPublishedIndex(input);

    expect(prisma.__tx.customIndexValue.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.__tx.customIndexValue.upsert).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { tenantId_idempotencyKey: { tenantId: "tenant-a", idempotencyKey: "IPC:2026-05" } },
      create: expect.objectContaining({ periodDate: new Date("2026-05-01T00:00:00.000Z") })
    }));
    expect(prisma.__tx.customIndexValue.upsert).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { tenantId_idempotencyKey: { tenantId: "tenant-a", idempotencyKey: "IPC:2026-05" } },
      update: expect.objectContaining({ value: "125.250000" })
    }));
    expect(prisma.__tx.contractAdjustment.createMany).not.toHaveBeenCalled();
  });

  it("keeps same index/date from different sources in one schema-valid value row", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.economicIndex.findUnique).mockResolvedValue({ id: "economic-index-ipc", type: "IPC", name: "IPC", source: "ARQUILER" } as never);
    vi.mocked(prisma.rentPeriod.findMany).mockResolvedValue([] as never);
    prisma.__tx.customIndexValue.upsert
      .mockResolvedValueOnce({ id: "index-value-ipc", tenantId: "tenant-a", value: "125.250000" })
      .mockResolvedValueOnce({ id: "index-value-ipc", tenantId: "tenant-a", value: "124.000000" });
    const service = new IndicesService(prisma, createContextMock("tenant-a"));
    const periodDate = new Date("2026-05-01T00:00:00.000Z");

    await service.persistPublishedIndex({ source: "ARQUILER", type: "IPC", periodDate, value: "125.250000", publishedAt: new Date("2026-05-17T12:00:00.000Z") });
    await service.persistPublishedIndex({ source: "MANUAL", type: "IPC", periodDate, value: "124.000000", publishedAt: new Date("2026-05-16T09:00:00.000Z") });

    expect(prisma.__tx.customIndexValue.upsert).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { tenantId_idempotencyKey: { tenantId: "tenant-a", idempotencyKey: "IPC:2026-05" } },
      create: expect.objectContaining({ economicIndexId: "economic-index-ipc", isManual: false, source: "ARQUILER" })
    }));
    expect(prisma.__tx.customIndexValue.upsert).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { tenantId_idempotencyKey: { tenantId: "tenant-a", idempotencyKey: "IPC:2026-05" } },
      create: expect.objectContaining({ economicIndexId: "economic-index-ipc", isManual: true, source: "MANUAL", uploadedById: "user-1" }),
      update: expect.objectContaining({ isManual: true, source: "MANUAL", uploadedById: "user-1" })
    }));
  });

  it("persists manual index uploads with manual semantics and uploader trace", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.economicIndex.findUnique).mockResolvedValue({ id: "economic-index-ipc", type: "IPC", name: "IPC", source: "ARQUILER" } as never);
    vi.mocked(prisma.rentPeriod.findMany).mockResolvedValue([] as never);
    prisma.__tx.customIndexValue.upsert.mockResolvedValue({ id: "index-value-manual", tenantId: "tenant-a", value: "124.000000" });
    const service = new IndicesService(prisma, createContextMock("tenant-a"));

    await service.persistPublishedIndex({
      source: "MANUAL",
      type: "IPC",
      periodDate: new Date("2026-05-19T21:45:00.000Z"),
      value: "124.000000",
      publishedAt: new Date("2026-05-16T09:00:00.000Z")
    });

    expect(prisma.__tx.customIndexValue.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId_idempotencyKey: { tenantId: "tenant-a", idempotencyKey: "IPC:2026-05" } },
      create: expect.objectContaining({
        isManual: true,
        source: "MANUAL",
        uploadedById: "user-1",
        publishedAt: new Date("2026-05-16T09:00:00.000Z")
      }),
      update: expect.objectContaining({
        value: "124.000000",
        uploadedById: "user-1",
        publishedAt: new Date("2026-05-16T09:00:00.000Z")
      })
    }));
  });

  it("does not assign the request user as uploader for provider values", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.economicIndex.findUnique).mockResolvedValue({ id: "economic-index-ipc", type: "IPC", name: "IPC", source: "ARQUILER" } as never);
    vi.mocked(prisma.rentPeriod.findMany).mockResolvedValue([] as never);
    prisma.__tx.customIndexValue.upsert.mockResolvedValue({ id: "index-value-1", tenantId: "tenant-a", value: "125.250000" });
    const service = new IndicesService(prisma, createContextMock("tenant-a"));

    await service.persistPublishedIndex({
      source: "ARQUILER",
      type: "IPC",
      periodDate: new Date("2026-05-01T00:00:00.000Z"),
      value: "125.250000",
      publishedAt: new Date("2026-05-17T12:00:00.000Z")
    });

    const upsertInput = prisma.__tx.customIndexValue.upsert.mock.calls[0]?.[0];
    expect(upsertInput.create).not.toHaveProperty("uploadedById");
    expect(upsertInput.update).toHaveProperty("uploadedById", null);
  });

  it("preserves manual trace source and estimated amount inputs for each pending reconciliation", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.economicIndex.findUnique).mockResolvedValue({ id: "economic-index-ipc", type: "IPC", name: "IPC", source: "ARQUILER" } as never);
    vi.mocked(prisma.rentPeriod.findMany).mockResolvedValue([
      {
        id: "period-1",
        contractId: "contract-1",
        estimatedAmount: "100000.00",
        estimatedIndexValue: "120.500000",
        estimatedIndexSource: "tenant_manual_projection"
      },
      {
        id: "period-2",
        contractId: "contract-2",
        estimatedAmount: "250000.00",
        estimatedIndexValue: null,
        estimatedIndexSource: null
      }
    ] as never);
    prisma.__tx.customIndexValue.upsert.mockResolvedValue({ id: "index-value-manual", tenantId: "tenant-a", value: "124.000000" });
    const service = new IndicesService(prisma, createContextMock("tenant-a"));

    await service.persistPublishedIndex({
      source: "MANUAL",
      type: "IPC",
      periodDate: new Date("2026-05-01T00:00:00.000Z"),
      value: "124.000000",
      publishedAt: new Date("2026-05-16T09:00:00.000Z")
    });

    expect(prisma.__tx.contractAdjustment.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          source: "MANUAL",
          economicIndexValueId: "index-value-manual",
          rentPeriodId: "period-1",
          estimatedAmount: "100000.00",
          estimatedIndexValue: "120.500000",
          estimatedIndexSource: "tenant_manual_projection",
          realIndexValue: "124.000000"
        }),
        expect.objectContaining({
          source: "MANUAL",
          economicIndexValueId: "index-value-manual",
          rentPeriodId: "period-2",
          estimatedAmount: "250000.00",
          estimatedIndexValue: null,
          estimatedIndexSource: null,
          realIndexValue: "124.000000"
        })
      ],
      skipDuplicates: true
    });
  });

  it("rejects unsupported index types with a Spanish user-facing message before persistence", async () => {
    const prisma = createPrismaMock();
    const service = new IndicesService(prisma, createContextMock("tenant-a"));

    await expect(service.persistPublishedIndex({
      source: "ARQUILER",
      type: "CER" as never,
      periodDate: new Date("2026-05-01T00:00:00.000Z"),
      value: "125.250000",
      publishedAt: new Date("2026-05-17T12:00:00.000Z")
    })).rejects.toThrow("El tipo de índice económico no es válido.");
    expect(prisma.economicIndex.findUnique).not.toHaveBeenCalled();
    expect(prisma.__tx.customIndexValue.upsert).not.toHaveBeenCalled();
  });

  it("rejects persistence with a Spanish user-facing message when the economic index configuration is missing", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.economicIndex.findUnique).mockResolvedValue(null as never);
    const service = new IndicesService(prisma, createContextMock("tenant-a"));

    await expect(service.persistPublishedIndex({
      source: "ARQUILER",
      type: "IPC",
      periodDate: new Date("2026-05-01T00:00:00.000Z"),
      value: "125.250000",
      publishedAt: new Date("2026-05-17T12:00:00.000Z")
    })).rejects.toThrow("No encontramos la configuración del índice económico solicitado.");
    expect(prisma.economicIndex.findUnique).toHaveBeenCalledWith({
      where: { type_name: { type: "IPC", name: "IPC" } }
    });
    expect(prisma.rentPeriod.findMany).not.toHaveBeenCalled();
    expect(prisma.__tx.customIndexValue.upsert).not.toHaveBeenCalled();
  });
});

describe("IndicesService.detectPublishedIndex", () => {
  it("only enables the scheduled detection window from days 16-20 at 09:00", () => {
    const service = new IndicesService(createPrismaMock(), createContextMock("tenant-a"));

    expect(service.isScheduledDetectionWindow(new Date("2026-05-16T09:00:00.000Z"))).toBe(true);
    expect(service.isScheduledDetectionWindow(new Date("2026-05-20T09:30:00.000Z"))).toBe(true);
    expect(service.isScheduledDetectionWindow(new Date("2026-05-20T09:59:59.000Z"))).toBe(true);
    expect(service.isScheduledDetectionWindow(new Date("2026-05-16T08:59:59.000Z"))).toBe(false);
    expect(service.isScheduledDetectionWindow(new Date("2026-05-15T09:00:00.000Z"))).toBe(false);
    expect(service.isScheduledDetectionWindow(new Date("2026-05-17T10:00:00.000Z"))).toBe(false);
    expect(service.isScheduledDetectionWindow(new Date("2026-05-21T09:00:00.000Z"))).toBe(false);
  });

  it("uses Arquiler before manual fallback and keeps official/Argly as future adapter slots", async () => {
    expect(INDEX_PROVIDER_PRIORITY).toEqual(["ARQUILER", "MANUAL", "OFFICIAL", "ARGLY"]);
    const arquiler = createProvider("ARQUILER", "125.250000");
    const manual = createProvider("MANUAL", "124.000000");
    const service = new IndicesService(createPrismaMock(), createContextMock("tenant-a"), [manual, arquiler]);

    const detected = await service.detectPublishedIndex({ type: "IPC", periodDate: new Date("2026-05-01T00:00:00.000Z") });

    expect(detected).toEqual(expect.objectContaining({ source: "ARQUILER", value: "125.250000" }));
    expect(arquiler.fetchPublishedIndex).toHaveBeenCalledWith({ type: "IPC", periodDate: new Date("2026-05-01T00:00:00.000Z") });
    expect(manual.fetchPublishedIndex).not.toHaveBeenCalled();
  });

  it("falls back to manual values when Arquiler has not published the period yet", async () => {
    const arquiler = createProvider("ARQUILER", null);
    const manual = createProvider("MANUAL", "124.000000");
    const service = new IndicesService(createPrismaMock(), createContextMock("tenant-a"), [manual, arquiler]);

    const detected = await service.detectPublishedIndex({ type: "IPC", periodDate: new Date("2026-05-01T00:00:00.000Z") });

    expect(detected).toEqual(expect.objectContaining({ source: "MANUAL", value: "124.000000" }));
    expect(manual.fetchPublishedIndex).toHaveBeenCalledWith({ type: "IPC", periodDate: new Date("2026-05-01T00:00:00.000Z") });
  });

  it("uses persisted manual values as fallback when the primary provider is unavailable", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.customIndexValue.findFirst).mockResolvedValue({
      value: "124.000000",
      publishedAt: new Date("2026-05-16T09:00:00.000Z"),
      updatedAt: new Date("2026-05-16T10:00:00.000Z")
    } as never);
    const arquiler = createProvider("ARQUILER", null);
    const service = new IndicesService(prisma, createContextMock("tenant-a"), [arquiler]);

    const detected = await service.detectPublishedIndex({ type: "IPC", periodDate: new Date("2026-05-19T21:45:00.000Z") });

    expect(detected).toEqual({
      source: "MANUAL",
      type: "IPC",
      periodDate: new Date("2026-05-01T00:00:00.000Z"),
      value: "124.000000",
      publishedAt: new Date("2026-05-16T09:00:00.000Z")
    });
    expect(prisma.customIndexValue.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-a",
        periodDate: new Date("2026-05-01T00:00:00.000Z"),
        source: "MANUAL",
        isManual: true,
        economicIndex: { type: "IPC", name: "IPC" }
      },
      select: { value: true, publishedAt: true, updatedAt: true },
      orderBy: { updatedAt: "desc" }
    });
  });

  it("keeps official and Argly lower priority than manual fallback", async () => {
    const arquiler = createProvider("ARQUILER", null);
    const manual = createProvider("MANUAL", "124.000000");
    const official = createProvider("OFFICIAL", "123.000000");
    const argly = createProvider("ARGLY", "122.000000");
    const service = new IndicesService(createPrismaMock(), createContextMock("tenant-a"), [argly, official, manual, arquiler]);

    const detected = await service.detectPublishedIndex({ type: "IPC", periodDate: new Date("2026-05-01T00:00:00.000Z") });

    expect(detected).toEqual(expect.objectContaining({ source: "MANUAL", value: "124.000000" }));
    expect(official.fetchPublishedIndex).not.toHaveBeenCalled();
    expect(argly.fetchPublishedIndex).not.toHaveBeenCalled();
  });

  it("uses official before Argly only when primary and manual sources are unavailable", async () => {
    const arquiler = createProvider("ARQUILER", null);
    const manual = createProvider("MANUAL", null);
    const official = createProvider("OFFICIAL", "123.000000");
    const argly = createProvider("ARGLY", "122.000000");
    const service = new IndicesService(createPrismaMock(), createContextMock("tenant-a"), [argly, official, manual, arquiler]);

    const detected = await service.detectPublishedIndex({ type: "IPC", periodDate: new Date("2026-05-01T00:00:00.000Z") });

    expect(detected).toEqual(expect.objectContaining({ source: "OFFICIAL", value: "123.000000" }));
    expect(argly.fetchPublishedIndex).not.toHaveBeenCalled();
  });
});
