import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { Currency, EconomicIndexType, Prisma } from "@adpropia/database";
import { PrismaService } from "../../common/prisma";
import { RequestContextService } from "../../common/request-context/request-context.service";
import type { UpcomingAdjustmentsQueryDto } from "./reports.dto";

const DEFAULT_RANGE_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type UpcomingAdjustmentItem = {
  contractId: string;
  propertyId: string | null;
  renterId: string | null;
  ownerId: string | null;
  renterName: string | null;
  propertyAddress: string | null;
  currency: Currency;
  adjustmentDate: Date;
  currentAmount: string;
  adjustedAmount: string;
  index: {
    type: EconomicIndexType;
    source: string | null;
    value: string | null;
    period: string;
    status: "AVAILABLE" | "MISSING";
    message: string | null;
  };
};

export type UpcomingAdjustmentsReport = {
  from: string;
  to: string;
  total: number;
  items: UpcomingAdjustmentItem[];
};

type UpcomingAdjustmentContract = Prisma.RentalContractGetPayload<{
  include: {
    property: { select: { addressLine: true } };
    renter: { select: { displayName: true } };
    rentPeriods: {
      select: {
        id: true;
        periodStart: true;
        estimatedAmount: true;
        realAmount: true;
        estimatedIndexType: true;
        estimatedIndexValue: true;
        estimatedIndexSource: true;
        realIndexValue: true;
        realIndexSource: true;
        contractAdjustments: {
          select: {
            source: true;
            realIndexValue: true;
            realAmount: true;
            estimatedAmount: true;
            economicIndexValue: { select: { periodDate: true; value: true; source: true } };
          };
        };
      };
    };
  };
}>;

@Injectable()
export class UpcomingAdjustmentsReportService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(RequestContextService)
    private readonly contextService: RequestContextService
  ) {}

  async getUpcomingAdjustments(query: UpcomingAdjustmentsQueryDto): Promise<UpcomingAdjustmentsReport> {
    const { tenantId } = this.contextService.get();
    const now = new Date();
    const fromDate = query.from ? new Date(query.from) : startOfDay(now);
    const toDate = query.to ? new Date(query.to) : new Date(fromDate.getTime() + DEFAULT_RANGE_DAYS * MS_PER_DAY);

    if (fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException("El rango de fechas no es válido.");
    }

    const contracts = await this.prisma.rentalContract.findMany({
      where: {
        tenantId,
        status: "ACTIVE",
        nextAdjustmentAt: { gte: fromDate, lte: toDate },
        ...(query.contractId !== undefined ? { id: query.contractId } : {}),
        ...(query.renterId !== undefined ? { renterId: query.renterId } : {}),
        ...(query.propertyId !== undefined ? { propertyId: query.propertyId } : {})
      },
      include: {
        property: { select: { addressLine: true } },
        renter: { select: { displayName: true } },
        rentPeriods: {
          select: {
            id: true,
            periodStart: true,
            estimatedAmount: true,
            realAmount: true,
            estimatedIndexType: true,
            estimatedIndexValue: true,
            estimatedIndexSource: true,
            realIndexValue: true,
            realIndexSource: true,
            contractAdjustments: {
              select: {
                source: true,
                realIndexValue: true,
                realAmount: true,
                estimatedAmount: true,
                economicIndexValue: { select: { periodDate: true, value: true, source: true } }
              }
            }
          },
          orderBy: { periodStart: "asc" }
        }
      },
      orderBy: { nextAdjustmentAt: "asc" }
    });

    const items = (contracts as UpcomingAdjustmentContract[]).map(buildUpcomingAdjustmentItem);

    return {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      total: items.length,
      items
    };
  }
}

function startOfDay(date: Date): Date {
  const copy = new Date(date.getTime());
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function startOfMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function buildUpcomingAdjustmentItem(contract: UpcomingAdjustmentContract): UpcomingAdjustmentItem {
  const adjustmentDate = contract.nextAdjustmentAt!;
  const adjustmentPeriod = startOfMonth(adjustmentDate);
  const currentPeriod = [...contract.rentPeriods]
    .filter((period) => period.periodStart.getTime() < adjustmentPeriod.getTime())
    .sort((a, b) => b.periodStart.getTime() - a.periodStart.getTime())[0];
  const adjustedPeriod = contract.rentPeriods.find((period) => period.periodStart.getTime() === adjustmentPeriod.getTime());
  const adjustmentTrace = adjustedPeriod?.contractAdjustments[0];

  const currentAmount = amountFromPeriod(currentPeriod) ?? contract.monthlyTotalAmount?.toString() ?? contract.rentAmount.toString();
  const adjustedAmount = adjustmentTrace?.realAmount?.toString() ?? amountFromPeriod(adjustedPeriod) ?? currentAmount;
  const index = resolveAppliedIndex(contract.adjustmentIndexType, adjustmentPeriod, adjustedPeriod, adjustmentTrace);

  return {
    contractId: contract.id,
    propertyId: contract.propertyId,
    renterId: contract.renterId,
    ownerId: contract.ownerId,
    renterName: contract.renter?.displayName ?? null,
    propertyAddress: contract.property?.addressLine ?? null,
    currency: contract.currency,
    adjustmentDate,
    currentAmount,
    adjustedAmount,
    index
  };
}

function amountFromPeriod(period: UpcomingAdjustmentContract["rentPeriods"][number] | undefined): string | null {
  if (!period) {
    return null;
  }

  return period.realAmount?.toString() ?? period.estimatedAmount.toString();
}

function resolveAppliedIndex(
  type: EconomicIndexType,
  period: Date,
  rentPeriod: UpcomingAdjustmentContract["rentPeriods"][number] | undefined,
  adjustmentTrace: UpcomingAdjustmentContract["rentPeriods"][number]["contractAdjustments"][number] | undefined
): UpcomingAdjustmentItem["index"] {
  const traceIndex = adjustmentTrace?.economicIndexValue;
  const value = adjustmentTrace?.realIndexValue?.toString() ?? rentPeriod?.realIndexValue?.toString() ?? traceIndex?.value.toString() ?? rentPeriod?.estimatedIndexValue?.toString() ?? null;
  const source = adjustmentTrace?.source ?? rentPeriod?.realIndexSource ?? traceIndex?.source ?? rentPeriod?.estimatedIndexSource ?? null;
  const indexPeriod = traceIndex?.periodDate ?? period;

  return {
    type,
    source,
    value,
    period: formatYearMonth(indexPeriod),
    status: value === null ? "MISSING" : "AVAILABLE",
    message: value === null ? "Falta cargar el valor del índice para el período de ajuste." : null
  };
}

function formatYearMonth(value: Date): string {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}
