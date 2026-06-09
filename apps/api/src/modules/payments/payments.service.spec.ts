import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../common/prisma";
import type { RequestContextService } from "../../common/request-context/request-context.service";
import type { AuditService } from "../audit/audit.service";
import { PaymentsService } from "./payments.service";

type TxClient = {
  payment: { create: ReturnType<typeof vi.fn> };
  cashMovement: { create: ReturnType<typeof vi.fn> };
  rentPayment: { create: ReturnType<typeof vi.fn> };
  tenantBalanceMovement: { create: ReturnType<typeof vi.fn> };
};

function createPrismaMock() {
  const tx: TxClient = {
    payment: { create: vi.fn() },
    cashMovement: { create: vi.fn() },
    rentPayment: { create: vi.fn() },
    tenantBalanceMovement: { create: vi.fn() }
  };

  const prisma = {
    rentalContract: {
      findUnique: vi.fn()
    },
    payment: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    },
    rentPeriod: {
      findUnique: vi.fn()
    },
    cashMovement: {
      findMany: vi.fn()
    },
    $transaction: vi.fn(async (fn: (client: TxClient) => unknown) => fn(tx))
  } as unknown as PrismaService & { __tx: TxClient };

  (prisma as unknown as { __tx: TxClient }).__tx = tx;
  return prisma as PrismaService & { __tx: TxClient };
}

function createContextMock(tenantId = "tenant-a") {
  return {
    get: () => ({ requestId: "req-1", userId: "user-1", tenantId, role: "ADMIN" })
  } as RequestContextService;
}

function createAuditMock(): AuditService {
  return {
    createEntry: vi.fn().mockResolvedValue({}),
    createEntryWithClient: vi.fn().mockResolvedValue({ audit: true })
  } as unknown as AuditService;
}

async function expectHttpException(
  action: () => Promise<unknown>,
  errorClass: typeof BadRequestException | typeof NotFoundException,
  status: number,
  message: string
) {
  try {
    await action();
    throw new Error("Expected action to reject.");
  } catch (error) {
    expect(error).toBeInstanceOf(errorClass);
    expect((error as { getStatus: () => number }).getStatus()).toBe(status);
    expect((error as Error).message).toBe(message);
  }
}

const baseContract = {
  id: "contract-1",
  tenantId: "tenant-a",
  renterId: "renter-1",
  ownerId: "owner-1",
  propertyId: "property-1",
  currency: "ARS",
  status: "ACTIVE"
} as const;

const createInput = {
  contractId: "contract-1",
  renterId: "renter-1",
  dueAmount: "100000.00",
  paidAmount: "100000.00",
  currency: "ARS" as const,
  dueAt: "2026-05-10T00:00:00.000Z",
  paidAt: "2026-05-09T12:00:00.000Z"
};

describe("PaymentsService.createPayment", () => {
  it("looks up the contract through the active tenant compound key", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findUnique).mockResolvedValue(baseContract as never);
    prisma.__tx.payment.create.mockResolvedValue({ id: "payment-tenant", tenantId: "tenant-b" });
    const service = new PaymentsService(prisma, createContextMock("tenant-b"), createAuditMock());

    await service.createPayment(createInput);

    expect(prisma.rentalContract.findUnique).toHaveBeenCalledWith({
      where: { id_tenantId: { id: "contract-1", tenantId: "tenant-b" } }
    });
  });

  it("creates Payment and CashMovement in the same transaction when paidAmount > 0", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    vi.mocked(prisma.rentalContract.findUnique).mockResolvedValue(baseContract as never);
    prisma.__tx.payment.create.mockResolvedValue({ id: "payment-1", tenantId: "tenant-a" });
    prisma.__tx.cashMovement.create.mockResolvedValue({ id: "movement-1", tenantId: "tenant-a" });
    const service = new PaymentsService(prisma, createContextMock("tenant-a"), audit);

    await service.createPayment({ ...createInput, notes: "Paid in cash." });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.__tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-a",
        contractId: "contract-1",
        renterId: "renter-1",
        status: "PAID",
        dueAmount: "100000.00",
        paidAmount: "100000.00",
        remainingDebt: "0.00",
        creditBalance: "0.00",
        currency: "ARS",
        paidAt: new Date("2026-05-09T12:00:00.000Z"),
        notes: "Paid in cash."
      })
    });
    expect(prisma.__tx.cashMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-a",
        paymentId: "payment-1",
        type: "INCOME",
        amount: "100000.00",
        currency: "ARS",
        sourceType: "PAYMENT",
        sourceId: "payment-1",
        reason: "Paid in cash."
      })
    });
    expect(audit.createEntryWithClient).toHaveBeenCalledWith(prisma.__tx, expect.objectContaining({ tenantId: "tenant-a" }), {
      entityType: "payment",
      entityId: "payment-1",
      action: "payment.created",
      metadata: { contractId: "contract-1", status: "PAID", currency: "ARS" }
    });
  });

  it("wraps transaction failures in the payment registration domain error", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findUnique).mockResolvedValue(baseContract as never);
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("database unavailable") as never);
    const service = new PaymentsService(prisma, createContextMock("tenant-a"), createAuditMock());

    await expectHttpException(
      () => service.createPayment(createInput),
      BadRequestException,
      400,
      "No pudimos registrar el pago. Revisá los datos enviados."
    );
  });

  it("creates only the Payment with status PENDING when paidAmount === 0 (no cash movement)", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findUnique).mockResolvedValue(baseContract as never);
    prisma.__tx.payment.create.mockResolvedValue({ id: "payment-2", tenantId: "tenant-a" });
    const service = new PaymentsService(prisma, createContextMock("tenant-a"), createAuditMock());

    await service.createPayment({ ...createInput, paidAmount: "0", paidAt: undefined });

    expect(prisma.__tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "PENDING", paidAmount: "0", remainingDebt: "100000.00", creditBalance: "0.00" })
    });
    expect(prisma.__tx.cashMovement.create).not.toHaveBeenCalled();
  });

  it("rejects when the contract does not exist for the active tenant", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findUnique).mockResolvedValue(null);
    const service = new PaymentsService(prisma, createContextMock("tenant-a"), createAuditMock());

    await expectHttpException(() => service.createPayment(createInput), BadRequestException, 400, "El contrato indicado no existe en esta inmobiliaria.");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects when the contract is CANCELLED", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findUnique).mockResolvedValue({ ...baseContract, status: "CANCELLED" } as never);
    const service = new PaymentsService(prisma, createContextMock("tenant-a"), createAuditMock());

    await expectHttpException(() => service.createPayment(createInput), BadRequestException, 400, "No se pueden registrar pagos sobre un contrato cancelado.");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects when the renterId does not match the contract renter", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findUnique).mockResolvedValue({ ...baseContract, renterId: "other-renter" } as never);
    const service = new PaymentsService(prisma, createContextMock("tenant-a"), createAuditMock());

    await expectHttpException(() => service.createPayment(createInput), BadRequestException, 400, "El inquilino indicado no corresponde al contrato seleccionado.");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects when the currency does not match the contract currency", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findUnique).mockResolvedValue({ ...baseContract, currency: "USD" } as never);
    const service = new PaymentsService(prisma, createContextMock("tenant-a"), createAuditMock());

    await expectHttpException(() => service.createPayment(createInput), BadRequestException, 400, "La moneda del pago no coincide con la del contrato.");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("derives PARTIAL status and remainingDebt when paidAmount < dueAmount", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findUnique).mockResolvedValue(baseContract as never);
    prisma.__tx.payment.create.mockResolvedValue({ id: "payment-3", tenantId: "tenant-a" });
    const service = new PaymentsService(prisma, createContextMock("tenant-a"), createAuditMock());

    await service.createPayment({ ...createInput, dueAmount: "100000.00", paidAmount: "60000.50" });

    expect(prisma.__tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "PARTIAL", remainingDebt: "39999.50", creditBalance: "0.00" })
    });
  });

  it("derives OVERPAID status and creditBalance when paidAmount > dueAmount", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findUnique).mockResolvedValue(baseContract as never);
    prisma.__tx.payment.create.mockResolvedValue({ id: "payment-4", tenantId: "tenant-a" });
    const service = new PaymentsService(prisma, createContextMock("tenant-a"), createAuditMock());

    await service.createPayment({ ...createInput, dueAmount: "100000.00", paidAmount: "150000.00" });

    expect(prisma.__tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "OVERPAID", remainingDebt: "0.00", creditBalance: "50000.00" })
    });
  });
});

describe("PaymentsService.recordRentPayment", () => {
  it("records early estimated-period payments as ON_ACCOUNT rent payment events with a cash boundary link", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    vi.mocked(prisma.rentPeriod.findUnique).mockResolvedValue({
      id: "period-1",
      tenantId: "tenant-a",
      contractId: "contract-1",
      tenantPersonaId: "tenant-persona-1",
      calculationState: "ESTIMATED",
      currency: "ARS",
      estimatedAmount: "100000.00",
      realAmount: null
    } as never);
    prisma.__tx.rentPayment.create.mockResolvedValue({ id: "rent-payment-1", tenantId: "tenant-a", rentPeriodId: "period-1" });
    prisma.__tx.cashMovement.create.mockResolvedValue({ id: "cash-movement-1", tenantId: "tenant-a" });
    const service = new PaymentsService(prisma, createContextMock("tenant-a"), audit);

    await service.recordRentPayment({
      rentPeriodId: "period-1",
      amount: "100000.00",
      currency: "ARS",
      paidAt: "2026-05-05T12:00:00.000Z",
      notes: "Paid before IPC publication."
    });

    expect(prisma.__tx.rentPayment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-a",
        rentPeriodId: "period-1",
        type: "ON_ACCOUNT",
        amount: "100000.00",
        currency: "ARS",
        paidAt: new Date("2026-05-05T12:00:00.000Z"),
        cashMovementId: null,
        commissionMovementId: null,
        notes: "Paid before IPC publication."
      })
    });
    expect(prisma.__tx.cashMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-a",
        type: "INCOME",
        amount: "100000.00",
        currency: "ARS",
        sourceType: "RENT_PAYMENT",
        sourceId: "rent-payment-1",
        reason: "Paid before IPC publication."
      })
    });
    expect(audit.createEntryWithClient).toHaveBeenCalledWith(prisma.__tx, expect.objectContaining({ tenantId: "tenant-a" }), {
      entityType: "rent_payment",
      entityId: "rent-payment-1",
      action: "rent_payment.recorded",
      metadata: { rentPeriodId: "period-1", type: "ON_ACCOUNT", currency: "ARS" }
    });
  });

  it("trims rent payment notes and wraps transaction failures in the rent payment domain error", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentPeriod.findUnique).mockResolvedValue({ id: "period-1", tenantId: "tenant-a", calculationState: "RECONCILED", currency: "ARS" } as never);
    prisma.__tx.rentPayment.create.mockResolvedValue({ id: "rent-payment-3", tenantId: "tenant-a", rentPeriodId: "period-1" });
    const service = new PaymentsService(prisma, createContextMock("tenant-a"), createAuditMock());

    await service.recordRentPayment({ rentPeriodId: "period-1", amount: "100000.00", currency: "ARS", paidAt: "2026-05-20T12:00:00.000Z", notes: "  Paid with transfer.  " });

    expect(prisma.__tx.rentPayment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ notes: "Paid with transfer." })
    });

    vi.clearAllMocks();
    vi.mocked(prisma.rentPeriod.findUnique).mockResolvedValue({ id: "period-1", tenantId: "tenant-a", calculationState: "RECONCILED", currency: "ARS" } as never);
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("database unavailable") as never);

    await expectHttpException(
      () => service.recordRentPayment({ rentPeriodId: "period-1", amount: "100000.00", currency: "ARS", paidAt: "2026-05-20T12:00:00.000Z" }),
      BadRequestException,
      400,
      "No pudimos registrar el pago de alquiler. Revisá los datos enviados."
    );
  });

  it("keeps final-period collection as FINAL rent payment event instead of a boolean paid flag", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentPeriod.findUnique).mockResolvedValue({
      id: "period-2",
      tenantId: "tenant-a",
      contractId: "contract-1",
      tenantPersonaId: "tenant-persona-1",
      calculationState: "RECONCILED",
      currency: "ARS",
      estimatedAmount: "100000.00",
      realAmount: "112000.00"
    } as never);
    prisma.__tx.rentPayment.create.mockResolvedValue({ id: "rent-payment-2", tenantId: "tenant-a", rentPeriodId: "period-2" });
    const service = new PaymentsService(prisma, createContextMock("tenant-a"), createAuditMock());

    await service.recordRentPayment({ rentPeriodId: "period-2", amount: "112000.00", currency: "ARS", paidAt: "2026-05-20T12:00:00.000Z" });

    expect(prisma.__tx.rentPayment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "FINAL", rentPeriodId: "period-2", amount: "112000.00" })
    });
    expect(prisma.__tx.rentPayment.create).not.toHaveBeenCalledWith({ data: expect.objectContaining({ paid: true }) });
  });

  it("rejects rent payments for periods outside the active tenant", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentPeriod.findUnique).mockResolvedValue(null);
    const service = new PaymentsService(prisma, createContextMock("tenant-a"), createAuditMock());

    await expectHttpException(
      () => service.recordRentPayment({ rentPeriodId: "period-x", amount: "100000.00", currency: "ARS", paidAt: "2026-05-05T12:00:00.000Z" }),
      BadRequestException,
      400,
      "El período de alquiler indicado no existe en esta inmobiliaria."
    );
    expect(prisma.rentPeriod.findUnique).toHaveBeenCalledWith({ where: { id_tenantId: { id: "period-x", tenantId: "tenant-a" } } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects rent payments when currency differs from the rent period", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentPeriod.findUnique).mockResolvedValue({ id: "period-1", tenantId: "tenant-a", calculationState: "RECONCILED", currency: "USD" } as never);
    const service = new PaymentsService(prisma, createContextMock("tenant-a"), createAuditMock());

    await expectHttpException(
      () => service.recordRentPayment({ rentPeriodId: "period-1", amount: "100000.00", currency: "ARS", paidAt: "2026-05-05T12:00:00.000Z" }),
      BadRequestException,
      400,
      "La moneda del pago no coincide con la del período de alquiler."
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("PaymentsService.recordTenantBalanceMovement", () => {
  it("records overpayment reconciliation differences as tenant credit movements", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    vi.mocked(prisma.rentPeriod.findUnique).mockResolvedValue({
      id: "period-1",
      tenantId: "tenant-a",
      contractId: "contract-1",
      tenantPersonaId: "tenant-persona-1",
      currency: "ARS"
    } as never);
    prisma.__tx.tenantBalanceMovement.create.mockResolvedValue({ id: "movement-1", tenantId: "tenant-a", type: "CREDIT" });
    const service = new PaymentsService(prisma, createContextMock("tenant-a"), audit);

    await service.recordTenantBalanceMovement({
      rentPeriodId: "period-1",
      paidAmount: "120000.00",
      realAmount: "100000.00",
      currency: "ARS",
      reason: "  Real index lower than estimated period.  "
    });

    expect(prisma.__tx.tenantBalanceMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-a",
        rentPeriodId: "period-1",
        tenantPersonaId: "tenant-persona-1",
        type: "CREDIT",
        amount: "20000.00",
        currency: "ARS",
        reason: "Real index lower than estimated period."
      })
    });
    expect(audit.createEntryWithClient).toHaveBeenCalledWith(prisma.__tx, expect.objectContaining({ tenantId: "tenant-a" }), {
      entityType: "tenant_balance_movement",
      entityId: "movement-1",
      action: "tenant_balance_movement.recorded",
      metadata: { rentPeriodId: "period-1", type: "CREDIT", currency: "ARS" }
    });
  });

  it("wraps transaction failures in the tenant balance domain error", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentPeriod.findUnique).mockResolvedValue({ id: "period-1", tenantId: "tenant-a", tenantPersonaId: "tenant-persona-1", currency: "ARS" } as never);
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("database unavailable") as never);
    const service = new PaymentsService(prisma, createContextMock("tenant-a"), createAuditMock());

    await expectHttpException(
      () => service.recordTenantBalanceMovement({ rentPeriodId: "period-1", paidAmount: "120000.00", realAmount: "100000.00", currency: "ARS" }),
      BadRequestException,
      400,
      "No pudimos registrar el saldo del inquilino. Revisá los datos enviados."
    );
  });

  it("records underpayment reconciliation differences as tenant debt movements", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentPeriod.findUnique).mockResolvedValue({
      id: "period-1",
      tenantId: "tenant-a",
      contractId: "contract-1",
      tenantPersonaId: "tenant-persona-1",
      currency: "ARS"
    } as never);
    prisma.__tx.tenantBalanceMovement.create.mockResolvedValue({ id: "movement-2", tenantId: "tenant-a", type: "DEBT" });
    const service = new PaymentsService(prisma, createContextMock("tenant-a"), createAuditMock());

    await service.recordTenantBalanceMovement({ rentPeriodId: "period-1", paidAmount: "90000.00", realAmount: "100000.00", currency: "ARS" });

    expect(prisma.__tx.tenantBalanceMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "DEBT", amount: "10000.00" })
    });
  });

  it("rejects balance movement when the rent period is missing for the active tenant", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentPeriod.findUnique).mockResolvedValue(null);
    const service = new PaymentsService(prisma, createContextMock("tenant-b"), createAuditMock());

    await expectHttpException(
      () => service.recordTenantBalanceMovement({ rentPeriodId: "period-x", paidAmount: "100000.00", realAmount: "120000.00", currency: "ARS" }),
      BadRequestException,
      400,
      "El período de alquiler indicado no existe en esta inmobiliaria."
    );
    expect(prisma.rentPeriod.findUnique).toHaveBeenCalledWith({ where: { id_tenantId: { id: "period-x", tenantId: "tenant-b" } } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects balance movement when the period has no tenant persona", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentPeriod.findUnique).mockResolvedValue({ id: "period-1", tenantId: "tenant-a", tenantPersonaId: null, currency: "ARS" } as never);
    const service = new PaymentsService(prisma, createContextMock("tenant-a"), createAuditMock());

    await expectHttpException(
      () => service.recordTenantBalanceMovement({ rentPeriodId: "period-1", paidAmount: "120000.00", realAmount: "100000.00", currency: "ARS" }),
      BadRequestException,
      400,
      "El período de alquiler necesita un inquilino asociado para registrar saldo."
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects balance movement when currency differs from the rent period", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentPeriod.findUnique).mockResolvedValue({ id: "period-1", tenantId: "tenant-a", tenantPersonaId: "tenant-persona-1", currency: "USD" } as never);
    const service = new PaymentsService(prisma, createContextMock("tenant-a"), createAuditMock());

    await expectHttpException(
      () => service.recordTenantBalanceMovement({ rentPeriodId: "period-1", paidAmount: "120000.00", realAmount: "100000.00", currency: "ARS" }),
      BadRequestException,
      400,
      "La moneda del saldo no coincide con la del período de alquiler."
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects balance movement when paid and real amounts have no difference", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentPeriod.findUnique).mockResolvedValue({ id: "period-1", tenantId: "tenant-a", tenantPersonaId: "tenant-persona-1", currency: "ARS" } as never);
    const service = new PaymentsService(prisma, createContextMock("tenant-a"), createAuditMock());

    await expectHttpException(
      () => service.recordTenantBalanceMovement({ rentPeriodId: "period-1", paidAmount: "100000.00", realAmount: "100000.00", currency: "ARS" }),
      BadRequestException,
      400,
      "No hay diferencia para registrar en el saldo del inquilino."
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("PaymentsService.listPayments", () => {
  it("filters by tenantId and contractId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.payment.findMany).mockResolvedValue([] as never);
    const service = new PaymentsService(prisma, createContextMock("tenant-b"), createAuditMock());

    await service.listPayments({ contractId: "contract-9" });

    expect(prisma.payment.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-b", contractId: "contract-9" },
      orderBy: { dueAt: "desc" }
    });
  });

  it("filters by tenantId and renterId", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.payment.findMany).mockResolvedValue([] as never);
    const service = new PaymentsService(prisma, createContextMock("tenant-c"), createAuditMock());

    await service.listPayments({ renterId: "renter-9" });

    expect(prisma.payment.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-c", renterId: "renter-9" },
      orderBy: { dueAt: "desc" }
    });
  });
});

describe("PaymentsService.getContractBalance", () => {
  it("aggregates totals and excludes VOIDED payments from pendingDebt and creditBalance", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findUnique).mockResolvedValue({ ...baseContract, currency: "ARS" } as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      { dueAmount: "100000.00", paidAmount: "60000.00", remainingDebt: "40000.00", creditBalance: "0.00", status: "PARTIAL" },
      { dueAmount: "100000.00", paidAmount: "100000.00", remainingDebt: "0.00", creditBalance: "0.00", status: "PAID" },
      { dueAmount: "100000.00", paidAmount: "50000.00", remainingDebt: "50000.00", creditBalance: "0.00", status: "VOIDED" }
    ] as never);
    const service = new PaymentsService(prisma, createContextMock("tenant-a"), createAuditMock());

    const balance = await service.getContractBalance("contract-1");

    expect(balance).toEqual(
      expect.objectContaining({
        contractId: "contract-1",
        currency: "ARS",
        totalDue: "300000.00",
        totalPaid: "210000.00",
        pendingDebt: "40000.00",
        creditBalance: "0.00"
      })
    );
    expect(balance.payments).toHaveLength(3);
    expect(prisma.payment.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-a", contractId: "contract-1" },
      orderBy: { dueAt: "desc" }
    });
  });

  it("aggregates positive credit balances from non-voided overpayments", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findUnique).mockResolvedValue({ ...baseContract, currency: "ARS" } as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      { dueAmount: "100000.00", paidAmount: "125000.00", remainingDebt: "0.00", creditBalance: "25000.00", status: "OVERPAID" }
    ] as never);
    const service = new PaymentsService(prisma, createContextMock("tenant-a"), createAuditMock());

    await expect(service.getContractBalance("contract-1")).resolves.toEqual(
      expect.objectContaining({ totalDue: "100000.00", totalPaid: "125000.00", pendingDebt: "0.00", creditBalance: "25000.00" })
    );
  });

  it("rejects when the contract does not belong to the tenant", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.rentalContract.findUnique).mockResolvedValue(null);
    const service = new PaymentsService(prisma, createContextMock("tenant-a"), createAuditMock());

    await expectHttpException(() => service.getContractBalance("contract-x"), NotFoundException, 404, "No encontramos el contrato solicitado.");
  });
});

describe("PaymentsService.getPaymentById", () => {
  it("returns a payment found inside the active tenant", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.payment.findUnique).mockResolvedValue({ id: "payment-1", tenantId: "tenant-z" } as never);
    const service = new PaymentsService(prisma, createContextMock("tenant-z"), createAuditMock());

    await expect(service.getPaymentById("payment-1")).resolves.toEqual({ id: "payment-1", tenantId: "tenant-z" });
  });

  it("looks up payments by id_tenantId and throws NotFound when missing", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(null);
    const service = new PaymentsService(prisma, createContextMock("tenant-z"), createAuditMock());

    await expectHttpException(() => service.getPaymentById("payment-x"), NotFoundException, 404, "No encontramos el pago solicitado.");
    expect(prisma.payment.findUnique).toHaveBeenCalledWith({
      where: { id_tenantId: { id: "payment-x", tenantId: "tenant-z" } }
    });
  });
});

describe("PaymentsService.listCashMovements", () => {
  it("filters cash movements by tenantId and date range", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.cashMovement.findMany).mockResolvedValue([] as never);
    const service = new PaymentsService(prisma, createContextMock("tenant-d"), createAuditMock());

    await service.listCashMovements({ from: "2026-04-01T00:00:00.000Z", to: "2026-04-30T00:00:00.000Z" });

    expect(prisma.cashMovement.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-d",
        occurredAt: { gte: new Date("2026-04-01T00:00:00.000Z"), lte: new Date("2026-04-30T00:00:00.000Z") }
      },
      orderBy: { occurredAt: "desc" }
    });
  });

  it("rejects when from is greater than to", async () => {
    const prisma = createPrismaMock();
    const service = new PaymentsService(prisma, createContextMock("tenant-d"), createAuditMock());

    await expectHttpException(
      () => service.listCashMovements({ from: "2026-05-30T00:00:00.000Z", to: "2026-05-01T00:00:00.000Z" }),
      BadRequestException,
      400,
      "El rango de fechas no es válido."
    );
  });

  it("accepts an inclusive date range where from equals to", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.cashMovement.findMany).mockResolvedValue([] as never);
    const service = new PaymentsService(prisma, createContextMock("tenant-d"), createAuditMock());

    await service.listCashMovements({ from: "2026-05-01T00:00:00.000Z", to: "2026-05-01T00:00:00.000Z" });

    expect(prisma.cashMovement.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-d",
        occurredAt: { gte: new Date("2026-05-01T00:00:00.000Z"), lte: new Date("2026-05-01T00:00:00.000Z") }
      },
      orderBy: { occurredAt: "desc" }
    });
  });

  it("applies one-sided date filters when only from or to is provided", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.cashMovement.findMany).mockResolvedValue([] as never);
    const service = new PaymentsService(prisma, createContextMock("tenant-d"), createAuditMock());

    await service.listCashMovements({ from: "2026-05-01T00:00:00.000Z" });
    expect(prisma.cashMovement.findMany).toHaveBeenLastCalledWith({
      where: { tenantId: "tenant-d", occurredAt: { gte: new Date("2026-05-01T00:00:00.000Z") } },
      orderBy: { occurredAt: "desc" }
    });

    await service.listCashMovements({ to: "2026-05-31T00:00:00.000Z" });
    expect(prisma.cashMovement.findMany).toHaveBeenLastCalledWith({
      where: { tenantId: "tenant-d", occurredAt: { lte: new Date("2026-05-31T00:00:00.000Z") } },
      orderBy: { occurredAt: "desc" }
    });
  });

  it("returns all tenant movements when no range is provided", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.cashMovement.findMany).mockResolvedValue([] as never);
    const service = new PaymentsService(prisma, createContextMock("tenant-e"), createAuditMock());

    await service.listCashMovements({});

    expect(prisma.cashMovement.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-e" },
      orderBy: { occurredAt: "desc" }
    });
  });
});
