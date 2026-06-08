import type { Currency, LiquidationAdjustmentSign } from "@adpropia/database";
import { fromCents, toCents } from "../../../common/money/decimal-cents";

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type CalculatorPayment = {
  paymentId: string;
  contractId: string;
  propertyId: string;
  propertyAddress: string;
  paidAt: Date;
  paidAmount: string; // decimal string ("100000.50")
  dueAmount: string;
  currency: Currency;
  status: "PAID" | "PARTIAL" | "OVERPAID" | "VOIDED" | "PENDING";
};

export type CalculatorPropertyCommission = {
  propertyId: string;
  commissionBps: number | null;
};

export type CalculatorAdjustment = {
  concept: string;
  amount: string; // decimal string
  sign: LiquidationAdjustmentSign; // CREDIT | DEBIT
};

export type CalculatorInput = {
  payments: CalculatorPayment[];
  propertyCommissions: CalculatorPropertyCommission[];
  defaultCommissionBps: number;
  adjustments?: CalculatorAdjustment[];
  currency: Currency;
  periodStart: Date;
  periodEnd: Date;
};

export type CalculatedLineItem = {
  paymentId: string;
  contractId: string;
  propertyId: string;
  propertyAddress: string;
  paidAt: Date;
  paidAmount: string;
  dueAmount: string;
  liquidableAmount: string;
  commissionBpsApplied: number;
  commissionAmount: string;
  netAmount: string;
  currency: Currency;
};

export type CalculatedTotals = {
  grossAmount: string;
  commissionAmount: string;
  adjustmentsTotal: string; // sum(CREDIT) - sum(DEBIT), can be negative
  netAmount: string; // gross - commission + adjustmentsTotal
  currency: Currency;
};

export type CalculatorResult = {
  lineItems: CalculatedLineItem[];
  totals: CalculatedTotals;
};

export type OwnerSettlementRentPeriod = {
  rentPeriodId: string;
  propertyId: string;
  calculationState: "ESTIMATED" | "RECONCILED";
  estimatedAmount: string;
  realAmount: string | null;
};

export type OwnerSettlementOwnershipShare = {
  propertyId: string;
  ownerPersonaId: string;
  ownershipShareBps: number;
};

export type OwnerSettlementInput = {
  rentPeriodId: string;
  propertyId: string;
  ownerPersonaId: string;
  realAmount: string;
  contractCommissionBps: number;
  commissionAmount: string;
  ownerPayoutBaseAmount: string;
  ownershipShareBps: number;
  ownerPayoutAmount: string;
  currency: Currency;
};

export type OwnerSettlementInputResult = {
  ownerInputs: OwnerSettlementInput[];
  totals: {
    realAmount: string;
    commissionAmount: string;
    ownerPayoutBaseAmount: string;
    currency: Currency;
  };
};

export type OwnerSettlementCalculationInput = {
  contractCommissionBps: number;
  currency: Currency;
  periods: OwnerSettlementRentPeriod[];
  ownershipShares: OwnerSettlementOwnershipShare[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────────────────────

const INCLUDED_PAYMENT_STATUSES: ReadonlySet<CalculatorPayment["status"]> = new Set([
  "PAID",
  "PARTIAL",
  "OVERPAID"
]);

const FULL_OWNERSHIP_BPS = 10000;
const MIN_BPS = 0;

function bigIntMin(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

function calculateBpsAmount(amountCents: bigint, bps: number): bigint {
  return (amountCents * BigInt(bps)) / BigInt(FULL_OWNERSHIP_BPS);
}

function calculateBpsAllocationsWithRemainder(
  amountCents: bigint,
  shares: OwnerSettlementOwnershipShare[]
): bigint[] {
  const rawAllocations = shares.map((share, index) => {
    const numerator = amountCents * BigInt(share.ownershipShareBps);
    return {
      index,
      floorCents: numerator / BigInt(FULL_OWNERSHIP_BPS),
      remainder: numerator % BigInt(FULL_OWNERSHIP_BPS)
    };
  });

  const allocations = rawAllocations.map((allocation) => allocation.floorCents);
  const allocatedCents = allocations.reduce((sum, amount) => sum + amount, 0n);
  let remainderCents = amountCents - allocatedCents;

  const remainderOrder = [...rawAllocations].sort((a, b) => {
    if (a.remainder > b.remainder) return -1;
    if (a.remainder < b.remainder) return 1;
    return a.index - b.index;
  });

  for (const allocation of remainderOrder) {
    if (remainderCents <= 0n) break;
    allocations[allocation.index] = (allocations[allocation.index] ?? 0n) + 1n;
    remainderCents -= 1n;
  }

  return allocations;
}

function normalizeBps(value: number): number {
  return Number.isFinite(value) ? Math.trunc(value) : 0;
}

function assertContractCommissionReady(commissionBps: number): void {
  if (commissionBps < MIN_BPS || commissionBps > FULL_OWNERSHIP_BPS) {
    throw new Error("La comisión del contrato debe estar entre 0% y 100%.");
  }
}

function groupOwnershipShares(
  shares: OwnerSettlementOwnershipShare[]
): Map<string, OwnerSettlementOwnershipShare[]> {
  const grouped = new Map<string, OwnerSettlementOwnershipShare[]>();
  for (const share of shares) {
    const entries = grouped.get(share.propertyId) ?? [];
    entries.push(share);
    grouped.set(share.propertyId, entries);
  }
  return grouped;
}

function assertOwnershipSharesReady(shares: OwnerSettlementOwnershipShare[]): void {
  if (shares.length === 0) {
    throw new Error("El contrato no tiene propietarios configurados para liquidar.");
  }

  const totalBps = shares.reduce((sum, share) => sum + share.ownershipShareBps, 0);
  if (totalBps !== FULL_OWNERSHIP_BPS) {
    throw new Error("La participación de propietarios debe sumar 100%.");
  }
}

export function calculateOwnerSettlementInputs(
  input: OwnerSettlementCalculationInput
): OwnerSettlementInputResult {
  const sharesByProperty = groupOwnershipShares(input.ownershipShares);
  const contractCommissionBps = normalizeBps(input.contractCommissionBps);
  assertContractCommissionReady(contractCommissionBps);
  const ownerInputs: OwnerSettlementInput[] = [];
  let totalRealCents = 0n;
  let totalCommissionCents = 0n;
  let totalOwnerPayoutBaseCents = 0n;

  for (const period of input.periods) {
    if (period.calculationState !== "RECONCILED" || period.realAmount === null) {
      throw new Error("No se puede liquidar un período estimado sin monto real reconciliado.");
    }

    const shares = sharesByProperty.get(period.propertyId) ?? [];
    assertOwnershipSharesReady(shares);

    const realCents = toCents(period.realAmount);
    const commissionCents = calculateBpsAmount(realCents, contractCommissionBps);
    const ownerPayoutBaseCents = realCents - commissionCents;

    totalRealCents += realCents;
    totalCommissionCents += commissionCents;
    totalOwnerPayoutBaseCents += ownerPayoutBaseCents;

    const ownerPayoutAllocations = calculateBpsAllocationsWithRemainder(ownerPayoutBaseCents, shares);

    for (const [index, share] of shares.entries()) {
      const ownerPayoutCents = ownerPayoutAllocations[index] ?? 0n;
      ownerInputs.push({
        rentPeriodId: period.rentPeriodId,
        propertyId: period.propertyId,
        ownerPersonaId: share.ownerPersonaId,
        realAmount: fromCents(realCents),
        contractCommissionBps,
        commissionAmount: fromCents(commissionCents),
        ownerPayoutBaseAmount: fromCents(ownerPayoutBaseCents),
        ownershipShareBps: share.ownershipShareBps,
        ownerPayoutAmount: fromCents(ownerPayoutCents),
        currency: input.currency
      });
    }
  }

  return {
    ownerInputs,
    totals: {
      realAmount: fromCents(totalRealCents),
      commissionAmount: fromCents(totalCommissionCents),
      ownerPayoutBaseAmount: fromCents(totalOwnerPayoutBaseCents),
      currency: input.currency
    }
  };
}

/**
 * Pure liquidation calculator. No DB, no async, no Nest decorators —
 * the service layer hydrates the input and calls `calculate` synchronously.
 *
 * All monetary math runs in `bigint` cents through the shared helpers in
 * `apps/api/src/common/money/decimal-cents.ts`. NEVER use `Number` for totals.
 *
 * Covers REQ-001 (gross), REQ-002 (BPS hierarchy + snapshot), REQ-003
 * (manual adjustments, signed), REQ-004 (multi-currency isolation).
 */
export class LiquidationCalculator {
  calculate(input: CalculatorInput): CalculatorResult {
    const periodStartMs = input.periodStart.getTime();
    const periodEndMs = input.periodEnd.getTime();

    // 1. Build a property → bps lookup with fallback to default.
    const bpsByProperty = this.buildBpsLookup(
      input.propertyCommissions,
      input.defaultCommissionBps
    );

    // 2. Filter payments (status, currency, period range) and project line items.
    const lineItems: CalculatedLineItem[] = [];
    for (const payment of input.payments) {
      if (!INCLUDED_PAYMENT_STATUSES.has(payment.status)) continue;
      if (payment.currency !== input.currency) continue;

      const paidAtMs = payment.paidAt.getTime();
      if (paidAtMs < periodStartMs || paidAtMs > periodEndMs) continue;

      lineItems.push(
        this.buildLineItem(payment, bpsByProperty, input.defaultCommissionBps, input.currency)
      );
    }

    // 3. Stable order: paidAt asc, then paymentId asc.
    lineItems.sort((a, b) => {
      const dt = a.paidAt.getTime() - b.paidAt.getTime();
      if (dt !== 0) return dt;
      if (a.paymentId < b.paymentId) return -1;
      if (a.paymentId > b.paymentId) return 1;
      return 0;
    });

    // 4. Aggregate totals in cents.
    let grossCents = 0n;
    let commissionCents = 0n;
    for (const item of lineItems) {
      grossCents += toCents(item.liquidableAmount);
      commissionCents += toCents(item.commissionAmount);
    }

    // 5. Adjustments: sum(CREDIT) - sum(DEBIT). Can be negative.
    let adjustmentsCents = 0n;
    for (const adj of input.adjustments ?? []) {
      const amountCents = toCents(adj.amount);
      adjustmentsCents += adj.sign === "CREDIT" ? amountCents : -amountCents;
    }

    // 6. Net = gross - commission + adjustmentsTotal. Can be negative.
    const netCents = grossCents - commissionCents + adjustmentsCents;

    return {
      lineItems,
      totals: {
        grossAmount: fromCents(grossCents),
        commissionAmount: fromCents(commissionCents),
        adjustmentsTotal: fromCents(adjustmentsCents),
        netAmount: fromCents(netCents),
        currency: input.currency
      }
    };
  }

  private buildBpsLookup(
    propertyCommissions: CalculatorPropertyCommission[],
    defaultCommissionBps: number
  ): Map<string, number> {
    const lookup = new Map<string, number>();
    for (const entry of propertyCommissions) {
      // null commissionBps means "use the tenant default" — REQ-002 fallback chain.
      const effective =
        entry.commissionBps === null ? defaultCommissionBps : entry.commissionBps;
      lookup.set(entry.propertyId, effective);
    }
    return lookup;
  }

  private resolveBps(
    propertyId: string,
    bpsByProperty: Map<string, number>,
    defaultCommissionBps: number
  ): number {
    // Property explicitly mapped → use that (already resolves null → default).
    if (bpsByProperty.has(propertyId)) {
      // Map.has narrows to true but TS still doesn't refine the get(); guard it.
      const value = bpsByProperty.get(propertyId);
      if (typeof value === "number") return value;
    }
    // Property not in lookup → fall back to tenant default.
    // Defensive: if neither is set we bottom out at 0 (REQ-002).
    return Number.isFinite(defaultCommissionBps) ? defaultCommissionBps : 0;
  }

  private buildLineItem(
    payment: CalculatorPayment,
    bpsByProperty: Map<string, number>,
    defaultCommissionBps: number,
    currency: Currency
  ): CalculatedLineItem {
    const paidCents = toCents(payment.paidAmount);
    const dueCents = toCents(payment.dueAmount);
    const liquidableCents = bigIntMin(paidCents, dueCents);

    const bps = this.resolveBps(payment.propertyId, bpsByProperty, defaultCommissionBps);

    // bigint floor division naturally truncates toward zero for non-negative values,
    // which matches REQ-002's "redondeando hacia abajo".
    const commissionCents = (liquidableCents * BigInt(bps)) / 10000n;
    const netCents = liquidableCents - commissionCents;

    return {
      paymentId: payment.paymentId,
      contractId: payment.contractId,
      propertyId: payment.propertyId,
      propertyAddress: payment.propertyAddress,
      paidAt: payment.paidAt,
      paidAmount: fromCents(paidCents),
      dueAmount: fromCents(dueCents),
      liquidableAmount: fromCents(liquidableCents),
      commissionBpsApplied: bps,
      commissionAmount: fromCents(commissionCents),
      netAmount: fromCents(netCents),
      currency
    };
  }
}
