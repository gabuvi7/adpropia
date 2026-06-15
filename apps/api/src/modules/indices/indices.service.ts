import { BadRequestException, Inject, Injectable, Optional } from "@nestjs/common";
import type { EconomicIndexType, Prisma } from "@adpropia/database";
import { PrismaService } from "../../common/prisma";
import { RequestContextService } from "../../common/request-context/request-context.service";

export type IndexProviderSource = "ARQUILER" | "MANUAL" | "OFFICIAL" | "ARGLY";

export const INDEX_PROVIDER_ADAPTERS = Symbol("INDEX_PROVIDER_ADAPTERS");
export const INDEX_PROVIDER_PRIORITY: IndexProviderSource[] = ["ARQUILER", "MANUAL", "OFFICIAL", "ARGLY"];
const SUPPORTED_ECONOMIC_INDEX_TYPES = ["IPC", "ICL", "UVA", "FIXED", "CUSTOM"] satisfies EconomicIndexType[];

export interface IndexProviderLookupInput {
  type: EconomicIndexType;
  periodDate: Date;
}

export interface PublishedIndexValue extends IndexProviderLookupInput {
  source: IndexProviderSource;
  value: string;
  publishedAt: Date;
}

export interface IndexProviderAdapter {
  source: IndexProviderSource;
  fetchPublishedIndex(input: IndexProviderLookupInput): Promise<Omit<PublishedIndexValue, "source"> | null>;
}

interface EstimatedRentPeriodForReconciliation {
  id: string;
  contractId: string;
  estimatedAmount: string;
  estimatedIndexValue: string | null;
  estimatedIndexSource: string | null;
}

interface PublishedIndexPersistenceContext {
  tenantId: string;
  userId: string;
  economicIndex: Prisma.EconomicIndexGetPayload<object>;
  periodDate: Date;
  idempotencyKey: string;
  estimatedPeriods: EstimatedRentPeriodForReconciliation[];
}

@Injectable()
export class IndicesService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(RequestContextService)
    private readonly contextService: RequestContextService,
    @Optional()
    @Inject(INDEX_PROVIDER_ADAPTERS)
    private readonly adapters: IndexProviderAdapter[] = []
  ) {}

  async detectPublishedIndex(input: IndexProviderLookupInput): Promise<PublishedIndexValue | null> {
    for (const source of INDEX_PROVIDER_PRIORITY) {
      const adapter = this.adapters.find((candidate) => candidate.source === source);
      const value = adapter ? await adapter.fetchPublishedIndex(input) : null;
      if (value) {
        return { ...value, source };
      }

      if (source === "MANUAL") {
        const manualValue = await this.findManualPublishedIndex(input);
        if (manualValue) {
          return manualValue;
        }
      }
    }

    return null;
  }

  isScheduledDetectionWindow(value = new Date()): boolean {
    const dayOfMonth = value.getUTCDate();
    const hour = value.getUTCHours();
    return dayOfMonth >= 16 && dayOfMonth <= 20 && hour === 9;
  }

  async persistPublishedIndex(input: PublishedIndexValue): Promise<unknown> {
    this.assertSupportedEconomicIndexType(input.type);
    const { tenantId, userId } = this.contextService.get();
    const periodDate = startOfMonth(input.periodDate);

    const persistenceContext: PublishedIndexPersistenceContext = {
      tenantId,
      userId,
      periodDate,
      idempotencyKey: buildIndexIdempotencyKey(input.type, periodDate),
      economicIndex: await this.resolveEconomicIndex(input.type),
      estimatedPeriods: await this.findEstimatedPeriodsForReconciliation(tenantId, input.type, periodDate)
    };

    return this.persistIndexValueWithReconciliation(input, persistenceContext);
  }

  private assertSupportedEconomicIndexType(type: EconomicIndexType): void {
    if (!SUPPORTED_ECONOMIC_INDEX_TYPES.includes(type)) {
      throw new BadRequestException("El tipo de índice económico no es válido.");
    }
  }

  private async resolveEconomicIndex(type: EconomicIndexType): Promise<Prisma.EconomicIndexGetPayload<object>> {
    const economicIndex = await this.prisma.economicIndex.findUnique({
      where: { type_name: { type, name: type } }
    });

    if (!economicIndex) {
      throw new BadRequestException("No encontramos la configuración del índice económico solicitado.");
    }

    return economicIndex;
  }

  private async findEstimatedPeriodsForReconciliation(
    tenantId: string,
    type: EconomicIndexType,
    periodDate: Date
  ): Promise<EstimatedRentPeriodForReconciliation[]> {
    return (await this.prisma.rentPeriod.findMany({
      where: {
        tenantId,
        calculationState: "ESTIMATED",
        estimatedIndexType: type,
        periodStart: periodDate
      },
      select: {
        id: true,
        contractId: true,
        estimatedAmount: true,
        estimatedIndexValue: true,
        estimatedIndexSource: true
      }
    })) as unknown as EstimatedRentPeriodForReconciliation[];
  }

  private persistIndexValueWithReconciliation(
    input: PublishedIndexValue,
    context: PublishedIndexPersistenceContext
  ): Promise<unknown> {
    return this.prisma.$transaction(async (tx) => {
      const indexValue = await this.upsertPublishedIndexValue(tx, input, context);
      await this.createReconciliationTraces(tx, input, context, indexValue.id);

      return indexValue;
    });
  }

  private upsertPublishedIndexValue(
    tx: Prisma.TransactionClient,
    input: PublishedIndexValue,
    context: PublishedIndexPersistenceContext
  ) {
    const uploadTrace = toUploadTrace(input.source, context.userId);

    return tx.customIndexValue.upsert({
      where: { tenantId_idempotencyKey: { tenantId: context.tenantId, idempotencyKey: context.idempotencyKey } },
      create: {
        tenantId: context.tenantId,
        economicIndexId: context.economicIndex.id,
        periodDate: context.periodDate,
        value: input.value,
        isManual: input.source === "MANUAL",
        source: input.source,
        idempotencyKey: context.idempotencyKey,
        publishedAt: input.publishedAt,
        ...uploadTrace.create
      },
      update: {
        value: input.value,
        isManual: input.source === "MANUAL",
        source: input.source,
        publishedAt: input.publishedAt,
        ...uploadTrace.update,
        metadata: { source: input.source, type: input.type }
      }
    });
  }

  private async createReconciliationTraces(
    tx: Prisma.TransactionClient,
    input: PublishedIndexValue,
    context: PublishedIndexPersistenceContext,
    economicIndexValueId: string
  ): Promise<void> {
    if (context.estimatedPeriods.length === 0) {
      return;
    }

    await tx.contractAdjustment.createMany({
      data: context.estimatedPeriods.map((period) =>
        toContractAdjustmentTraceCreateData(period, context.tenantId, input, economicIndexValueId)
      ),
      skipDuplicates: true
    });
  }

  private async findManualPublishedIndex(input: IndexProviderLookupInput): Promise<PublishedIndexValue | null> {
    const { tenantId } = this.contextService.get();
    const periodDate = startOfMonth(input.periodDate);
    const indexValue = await this.prisma.customIndexValue.findFirst({
      where: {
        tenantId,
        periodDate,
        source: "MANUAL",
        isManual: true,
        economicIndex: { type: input.type, name: input.type }
      },
      select: {
        value: true,
        publishedAt: true,
        updatedAt: true
      },
      orderBy: { updatedAt: "desc" }
    });

    if (!indexValue) {
      return null;
    }

    return {
      source: "MANUAL",
      type: input.type,
      periodDate,
      value: indexValue.value.toString(),
      publishedAt: indexValue.publishedAt ?? indexValue.updatedAt
    };
  }
}

function toUploadTrace(
  source: IndexProviderSource,
  userId: string
): { create: { uploadedById: string } | Record<string, never>; update: { uploadedById: string | null } } {
  if (source === "MANUAL") {
    return { create: { uploadedById: userId }, update: { uploadedById: userId } };
  }

  return { create: {}, update: { uploadedById: null } };
}

function toContractAdjustmentTraceCreateData(
  period: EstimatedRentPeriodForReconciliation,
  tenantId: string,
  input: PublishedIndexValue,
  economicIndexValueId: string
): Prisma.ContractAdjustmentUncheckedCreateInput {
  return {
    tenantId,
    contractId: period.contractId,
    rentPeriodId: period.id,
    economicIndexValueId,
    source: input.source,
    type: input.type,
    frequencyMonths: null,
    state: "PENDING_RECONCILIATION",
    estimatedAmount: period.estimatedAmount,
    estimatedIndexValue: period.estimatedIndexValue,
    estimatedIndexSource: period.estimatedIndexSource,
    realIndexValue: input.value,
    realAmount: null,
    differenceAmount: null,
    reconciledAt: null
  };
}

function buildIndexIdempotencyKey(type: EconomicIndexType, periodDate: Date): string {
  const month = `${periodDate.getUTCFullYear()}-${String(periodDate.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${type}:${month}`;
}

function startOfMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}
