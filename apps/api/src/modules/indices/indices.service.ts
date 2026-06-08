import { BadRequestException, Injectable } from "@nestjs/common";
import type { EconomicIndexType, Prisma } from "@adpropia/database";
import { PrismaService } from "../../common/prisma";
import { RequestContextService } from "../../common/request-context/request-context.service";

export type IndexProviderSource = "ARQUILER" | "MANUAL" | "OFFICIAL" | "ARGLY";

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

@Injectable()
export class IndicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contextService: RequestContextService,
    private readonly adapters: IndexProviderAdapter[] = []
  ) {}

  async detectPublishedIndex(input: IndexProviderLookupInput): Promise<PublishedIndexValue | null> {
    for (const source of INDEX_PROVIDER_PRIORITY) {
      const adapter = this.adapters.find((candidate) => candidate.source === source);
      if (!adapter) {
        continue;
      }

      const value = await adapter.fetchPublishedIndex(input);
      if (value) {
        return { ...value, source };
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
    if (!SUPPORTED_ECONOMIC_INDEX_TYPES.includes(input.type)) {
      throw new BadRequestException("El tipo de índice económico no es válido.");
    }

    const { tenantId } = this.contextService.get();
    const economicIndex = await this.prisma.economicIndex.findFirst({
      where: { type: input.type, name: input.type, source: input.source }
    });

    if (!economicIndex) {
      throw new BadRequestException("No encontramos la configuración del índice económico para esa fuente.");
    }

    const periodDate = startOfMonth(input.periodDate);
    const idempotencyKey = buildIndexIdempotencyKey(input.source, input.type, periodDate);
    const estimatedPeriods = (await this.prisma.rentPeriod.findMany({
      where: {
        tenantId,
        calculationState: "ESTIMATED",
        estimatedIndexType: input.type,
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

    return this.prisma.$transaction(async (tx) => {
      const indexValue = await tx.customIndexValue.upsert({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
        create: {
          tenantId,
          economicIndexId: economicIndex.id,
          periodDate,
          value: input.value,
          isManual: input.source === "MANUAL",
          source: input.source,
          idempotencyKey,
          publishedAt: input.publishedAt
        },
        update: {
          value: input.value,
          publishedAt: input.publishedAt,
          metadata: { source: input.source, type: input.type }
        }
      });

      if (estimatedPeriods.length > 0) {
        await tx.contractAdjustment.createMany({
          data: estimatedPeriods.map((period) =>
            toContractAdjustmentTraceCreateData(period, tenantId, input, indexValue.id)
          ),
          skipDuplicates: true
        });
      }

      return indexValue;
    });
  }
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

function buildIndexIdempotencyKey(source: IndexProviderSource, type: EconomicIndexType, periodDate: Date): string {
  const month = `${periodDate.getUTCFullYear()}-${String(periodDate.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${source}:${type}:${month}`;
}

function startOfMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}
