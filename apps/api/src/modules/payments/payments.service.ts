import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { CashMovement, Currency, Payment, Prisma } from "@adpropia/database";
import { allocatePaymentAmount, money } from "@adpropia/shared";
import { fromCents, toCents } from "../../common/money/decimal-cents";
import { PrismaService } from "../../common/prisma";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { AuditService } from "../audit/audit.service";
import type { CreatePaymentDto, ListCashMovementsQueryDto, ListPaymentsQueryDto } from "./payments.dto";

export type PaymentRecord = Payment;
export type CashMovementRecord = CashMovement;

export type ContractBalance = {
  contractId: string;
  currency: Currency;
  totalDue: string;
  totalPaid: string;
  pendingDebt: string;
  creditBalance: string;
  payments: PaymentRecord[];
};

export interface RecordRentPaymentDto {
  rentPeriodId: string;
  amount: string;
  currency: Currency;
  paidAt: string;
  notes?: string | undefined;
}

export interface RecordTenantBalanceMovementDto {
  rentPeriodId: string;
  paidAmount: string;
  realAmount: string;
  currency: Currency;
  reason?: string | undefined;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contextService: RequestContextService,
    private readonly audit: AuditService
  ) {}

  async createPayment(input: CreatePaymentDto): Promise<PaymentRecord> {
    const { tenantId } = this.contextService.get();

    const contract = await this.prisma.rentalContract.findUnique({
      where: { id_tenantId: { id: input.contractId, tenantId } }
    });

    if (!contract) {
      throw new BadRequestException("El contrato indicado no existe en esta inmobiliaria.");
    }

    if (contract.status === "CANCELLED") {
      throw new BadRequestException("No se pueden registrar pagos sobre un contrato cancelado.");
    }

    if (contract.renterId !== input.renterId) {
      throw new BadRequestException("El inquilino indicado no corresponde al contrato seleccionado.");
    }

    if (contract.currency !== input.currency) {
      throw new BadRequestException("La moneda del pago no coincide con la del contrato.");
    }

    const allocation = allocatePaymentAmount(
      money(toCents(input.dueAmount), input.currency),
      money(toCents(input.paidAmount), input.currency)
    );

    const remainingDebt = fromCents(allocation.remainingDebt.amountCents);
    const creditBalance = fromCents(allocation.creditBalance.amountCents);
    const occurredAt = input.paidAt ? new Date(input.paidAt) : new Date();

    const paymentData: Prisma.PaymentUncheckedCreateInput = {
      tenantId,
      contractId: input.contractId,
      renterId: input.renterId,
      status: allocation.status,
      dueAmount: input.dueAmount,
      paidAmount: input.paidAmount,
      remainingDebt,
      creditBalance,
      currency: input.currency,
      dueAt: new Date(input.dueAt),
      ...(input.paidAt !== undefined ? { paidAt: new Date(input.paidAt) } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {})
    };

    try {
      const payment = await this.prisma.$transaction(async (tx) => {
        const created = await tx.payment.create({ data: paymentData });

        if (allocation.paid.amountCents > 0n) {
          await tx.cashMovement.create({
            data: {
              tenantId,
              paymentId: created.id,
              type: "INCOME",
              amount: input.paidAmount,
              currency: input.currency,
              occurredAt,
              sourceType: "PAYMENT",
              sourceId: created.id,
              ...(input.notes !== undefined ? { reason: input.notes } : {})
            }
          });
        }

        const ctx = this.contextService.get();
        await this.audit.createEntryWithClient(tx, ctx, {
          entityType: "payment",
          entityId: created.id,
          action: "payment.created",
          metadata: { contractId: input.contractId, status: allocation.status, currency: input.currency }
        });

        return created;
      });

      return payment;
    } catch {
      throw new BadRequestException("No pudimos registrar el pago. Revisá los datos enviados.");
    }
  }

  async listPayments(query: ListPaymentsQueryDto): Promise<PaymentRecord[]> {
    const { tenantId } = this.contextService.get();

    return this.prisma.payment.findMany({
      where: {
        tenantId,
        ...(query.contractId !== undefined ? { contractId: query.contractId } : {}),
        ...(query.renterId !== undefined ? { renterId: query.renterId } : {})
      },
      orderBy: { dueAt: "desc" }
    });
  }

  async recordRentPayment(input: RecordRentPaymentDto): Promise<unknown> {
    const ctx = this.contextService.get();
    const { tenantId } = ctx;
    const period = await this.prisma.rentPeriod.findUnique({ where: { id_tenantId: { id: input.rentPeriodId, tenantId } } });

    if (!period) {
      throw new BadRequestException("El período de alquiler indicado no existe en esta inmobiliaria.");
    }

    if (period.currency !== input.currency) {
      throw new BadRequestException("La moneda del pago no coincide con la del período de alquiler.");
    }

    const paidAt = new Date(input.paidAt);
    const type = period.calculationState === "ESTIMATED" ? "ON_ACCOUNT" : "FINAL";

    try {
      return await this.prisma.$transaction(async (tx) => {
        const rentPayment = await tx.rentPayment.create({
          data: {
            tenantId,
            rentPeriodId: input.rentPeriodId,
            type,
            amount: input.amount,
            currency: input.currency,
            paidAt,
            cashMovementId: null,
            commissionMovementId: null,
            notes: input.notes?.trim() ?? null
          }
        });

        if (toCents(input.amount) > 0n) {
          await tx.cashMovement.create({
            data: {
              tenantId,
              type: "INCOME",
              amount: input.amount,
              currency: input.currency,
              occurredAt: paidAt,
              sourceType: "RENT_PAYMENT",
              sourceId: rentPayment.id,
              ...(input.notes !== undefined ? { reason: input.notes } : {})
            }
          });
        }

        await this.audit.createEntryWithClient(tx, ctx, {
          entityType: "rent_payment",
          entityId: rentPayment.id,
          action: "rent_payment.recorded",
          metadata: { rentPeriodId: input.rentPeriodId, type, currency: input.currency }
        });

        return rentPayment;
      });
    } catch {
      throw new BadRequestException("No pudimos registrar el pago de alquiler. Revisá los datos enviados.");
    }
  }

  async recordTenantBalanceMovement(input: RecordTenantBalanceMovementDto): Promise<unknown> {
    const ctx = this.contextService.get();
    const { tenantId } = ctx;
    const period = await this.prisma.rentPeriod.findUnique({ where: { id_tenantId: { id: input.rentPeriodId, tenantId } } });

    if (!period) {
      throw new BadRequestException("El período de alquiler indicado no existe en esta inmobiliaria.");
    }

    if (!period.tenantPersonaId) {
      throw new BadRequestException("El período de alquiler necesita un inquilino asociado para registrar saldo.");
    }
    const tenantPersonaId = period.tenantPersonaId;

    if (period.currency !== input.currency) {
      throw new BadRequestException("La moneda del saldo no coincide con la del período de alquiler.");
    }

    const paidCents = toCents(input.paidAmount);
    const realCents = toCents(input.realAmount);
    const differenceCents = paidCents - realCents;
    if (differenceCents === 0n) {
      throw new BadRequestException("No hay diferencia para registrar en el saldo del inquilino.");
    }

    const type = differenceCents > 0n ? "CREDIT" : "DEBT";
    const amount = fromCents(differenceCents > 0n ? differenceCents : -differenceCents);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const movement = await tx.tenantBalanceMovement.create({
          data: {
            tenantId,
            rentPeriodId: input.rentPeriodId,
            tenantPersonaId,
            type,
            amount,
            currency: input.currency,
            reason: input.reason?.trim() ?? null
          }
        });

        await this.audit.createEntryWithClient(tx, ctx, {
          entityType: "tenant_balance_movement",
          entityId: movement.id,
          action: "tenant_balance_movement.recorded",
          metadata: { rentPeriodId: input.rentPeriodId, type, currency: input.currency }
        });

        return movement;
      });
    } catch {
      throw new BadRequestException("No pudimos registrar el saldo del inquilino. Revisá los datos enviados.");
    }
  }

  async getPaymentById(id: string): Promise<PaymentRecord> {
    const { tenantId } = this.contextService.get();
    const payment = await this.prisma.payment.findUnique({ where: { id_tenantId: { id, tenantId } } });

    if (!payment) {
      throw new NotFoundException("No encontramos el pago solicitado.");
    }

    return payment;
  }

  async getContractBalance(contractId: string): Promise<ContractBalance> {
    const { tenantId } = this.contextService.get();
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id_tenantId: { id: contractId, tenantId } }
    });

    if (!contract) {
      throw new NotFoundException("No encontramos el contrato solicitado.");
    }

    const payments = await this.prisma.payment.findMany({
      where: { tenantId, contractId },
      orderBy: { dueAt: "desc" }
    });

    let totalDueCents = 0n;
    let totalPaidCents = 0n;
    let pendingDebtCents = 0n;
    let creditBalanceCents = 0n;

    for (const payment of payments) {
      totalDueCents += toCents(payment.dueAmount);
      totalPaidCents += toCents(payment.paidAmount);

      if (payment.status !== "VOIDED") {
        pendingDebtCents += toCents(payment.remainingDebt);
        creditBalanceCents += toCents(payment.creditBalance);
      }
    }

    return {
      contractId,
      currency: contract.currency,
      totalDue: fromCents(totalDueCents),
      totalPaid: fromCents(totalPaidCents),
      pendingDebt: fromCents(pendingDebtCents),
      creditBalance: fromCents(creditBalanceCents),
      payments
    };
  }

  async listCashMovements(query: ListCashMovementsQueryDto): Promise<CashMovementRecord[]> {
    const { tenantId } = this.contextService.get();

    if (query.from && query.to && Date.parse(query.from) > Date.parse(query.to)) {
      throw new BadRequestException("El rango de fechas no es válido.");
    }

    const occurredAt: Prisma.DateTimeFilter = {};
    if (query.from) {
      occurredAt.gte = new Date(query.from);
    }
    if (query.to) {
      occurredAt.lte = new Date(query.to);
    }

    return this.prisma.cashMovement.findMany({
      where: {
        tenantId,
        ...(query.from || query.to ? { occurredAt } : {})
      },
      orderBy: { occurredAt: "desc" }
    });
  }
}
