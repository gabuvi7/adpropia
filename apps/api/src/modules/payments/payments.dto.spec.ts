import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  balanceQuerySchema,
  createPaymentSchema,
  listCashMovementsQuerySchema,
  listPaymentsQuerySchema,
  recordRentPaymentSchema,
  recordTenantBalanceMovementSchema,
} from "./payments.dto";

type SchemaUnderTest = z.ZodType;

function messagesFor(schema: SchemaUnderTest, input: unknown, path?: PropertyKey[]) {
  const result = schema.safeParse(input);

  expect(result.success).toBe(false);

  if (result.success) {
    return [];
  }

  const issues = result.error.issues;
  return path === undefined
    ? issues.map((issue) => issue.message)
    : issues
        .filter((issue) => issue.path.join(".") === path.join("."))
        .map((issue) => issue.message);
}

function expectMessageFor(
  schema: SchemaUnderTest,
  input: unknown,
  path: PropertyKey[],
  message: string,
) {
  expect(messagesFor(schema, input, path)).toContain(message);
}

const validPayment = {
  contractId: "contract-1",
  renterId: "renter-1",
  dueAmount: "100000.50",
  paidAmount: "50000.25",
  currency: "ARS",
  dueAt: "2026-05-10T00:00:00.000Z",
  paidAt: "2026-05-09T12:00:00.000Z",
};

const validRentPayment = {
  rentPeriodId: "period-1",
  amount: "100000.50",
  currency: "ARS",
  paidAt: "2026-05-09T12:00:00.000Z",
};

const validTenantBalanceMovement = {
  rentPeriodId: "period-1",
  paidAmount: "90000.25",
  realAmount: "100000.50",
  currency: "ARS",
};

describe("payments DTO validation", () => {
  it("rejects missing, invalid type, empty, and whitespace-only payment ids while trimming valid ids", () => {
    expectMessageFor(createPaymentSchema, { ...validPayment, contractId: undefined }, ["contractId"], "El contrato es obligatorio.");
    expectMessageFor(createPaymentSchema, { ...validPayment, contractId: 42 }, ["contractId"], "El contrato debe ser texto.");
    expectMessageFor(createPaymentSchema, { ...validPayment, contractId: "" }, ["contractId"], "El contrato es obligatorio.");
    expectMessageFor(createPaymentSchema, { ...validPayment, renterId: "   " }, ["renterId"], "El inquilino es obligatorio.");
    expectMessageFor(balanceQuerySchema, { contractId: "   " }, ["contractId"], "El contrato es obligatorio.");

    const result = createPaymentSchema.safeParse({
      ...validPayment,
      contractId: "  contract-1  ",
      renterId: "  renter-1  ",
    });

    expect(result.success).toBe(true);
    expect(result.data?.contractId).toBe("contract-1");
    expect(result.data?.renterId).toBe("renter-1");
  });

  it("validates payment amounts, decimal precision, zero allowance, and numeric input normalization", () => {
    expectMessageFor(createPaymentSchema, { ...validPayment, dueAmount: "0" }, ["dueAmount"], "El monto adeudado debe ser mayor a cero.");
    expectMessageFor(createPaymentSchema, { ...validPayment, dueAmount: "100.999" }, ["dueAmount"], "El monto adeudado debe tener hasta dos decimales.");
    expectMessageFor(createPaymentSchema, { ...validPayment, dueAmount: "100x" }, ["dueAmount"], "El monto adeudado debe tener hasta dos decimales.");
    expectMessageFor(createPaymentSchema, { ...validPayment, dueAmount: "x100" }, ["dueAmount"], "El monto adeudado debe tener hasta dos decimales.");
    expectMessageFor(createPaymentSchema, { ...validPayment, dueAmount: -1 }, ["dueAmount"], "El monto adeudado debe tener hasta dos decimales.");
    expectMessageFor(createPaymentSchema, { ...validPayment, paidAmount: "-1" }, ["paidAmount"], "El monto pagado debe tener hasta dos decimales.");
    expectMessageFor(createPaymentSchema, { ...validPayment, paidAmount: "100.999" }, ["paidAmount"], "El monto pagado debe tener hasta dos decimales.");
    expectMessageFor(createPaymentSchema, { ...validPayment, paidAmount: "100x" }, ["paidAmount"], "El monto pagado debe tener hasta dos decimales.");
    expectMessageFor(createPaymentSchema, { ...validPayment, paidAmount: "x100" }, ["paidAmount"], "El monto pagado debe tener hasta dos decimales.");
    expect(createPaymentSchema.safeParse({ ...validPayment, paidAmount: Number.POSITIVE_INFINITY }).success).toBe(false);

    const zeroPaid = createPaymentSchema.safeParse({ ...validPayment, dueAmount: "  100.00  ", paidAmount: "  0  " });
    expect(zeroPaid.success).toBe(true);
    expect(zeroPaid.data?.dueAmount).toBe("100.00");
    expect(zeroPaid.data?.paidAmount).toBe("0");

    const numericAmounts = createPaymentSchema.safeParse({ ...validPayment, dueAmount: 1200.5, paidAmount: 0 });
    expect(numericAmounts.success).toBe(true);
    expect(numericAmounts.data?.dueAmount).toBe("1200.5");
    expect(numericAmounts.data?.paidAmount).toBe("0");
  });

  it("validates payment currency, dates, notes, and object-level messages in Spanish", () => {
    expectMessageFor(createPaymentSchema, { ...validPayment, currency: "EUR" }, ["currency"], "La moneda no es válida.");
    expectMessageFor(createPaymentSchema, { ...validPayment, dueAt: undefined }, ["dueAt"], "La fecha de vencimiento es obligatoria.");
    expectMessageFor(createPaymentSchema, { ...validPayment, dueAt: 42 }, ["dueAt"], "La fecha de vencimiento debe ser texto.");
    expectMessageFor(createPaymentSchema, { ...validPayment, dueAt: "bad-date" }, ["dueAt"], "La fecha de vencimiento debe ser una fecha ISO válida.");
    expectMessageFor(createPaymentSchema, { ...validPayment, paidAt: "   " }, ["paidAt"], "La fecha de pago es obligatoria.");
    expectMessageFor(createPaymentSchema, { ...validPayment, paidAt: "bad-date" }, ["paidAt"], "La fecha de pago debe ser una fecha ISO válida.");
    expectMessageFor(createPaymentSchema, { ...validPayment, notes: 42 }, ["notes"], "Las notas deben ser texto.");
    expectMessageFor(createPaymentSchema, { ...validPayment, notes: "x".repeat(501) }, ["notes"], "Las notas no pueden superar los 500 caracteres.");
    expect(messagesFor(createPaymentSchema, undefined)).toContain("Los datos del pago son obligatorios.");
    expect(messagesFor(createPaymentSchema, 42)).toContain("Los datos del pago no son válidos.");

    const result = createPaymentSchema.safeParse({ ...validPayment, paidAt: undefined, notes: "  Paid at office.  " });
    expect(result.success).toBe(true);
    expect(result.data?.notes).toBe("Paid at office.");
  });

  it("requires at least one list payment filter and trims accepted filters", () => {
    expect(messagesFor(listPaymentsQuerySchema, {})).toContain("Tenés que filtrar por contrato o por inquilino.");

    const blankContractFilter = listPaymentsQuerySchema.safeParse({ contractId: "   " });
    expect(blankContractFilter.success).toBe(false);
    expect(blankContractFilter.error?.issues.some((issue) => issue.path.join(".") === "contractId")).toBe(true);

    const blankRenterFilter = listPaymentsQuerySchema.safeParse({ renterId: "   " });
    expect(blankRenterFilter.success).toBe(false);
    expect(blankRenterFilter.error?.issues.some((issue) => issue.path.join(".") === "renterId")).toBe(true);

    const contractFilter = listPaymentsQuerySchema.safeParse({ contractId: "  contract-1  " });
    expect(contractFilter.success).toBe(true);
    expect(contractFilter.data?.contractId).toBe("contract-1");

    const renterFilter = listPaymentsQuerySchema.safeParse({ renterId: "  renter-1  " });
    expect(renterFilter.success).toBe(true);
    expect(renterFilter.data?.renterId).toBe("renter-1");
  });

  it("validates rent payment ids, amounts, currency, dates, and trims notes", () => {
    expectMessageFor(recordRentPaymentSchema, { ...validRentPayment, rentPeriodId: undefined }, ["rentPeriodId"], "El período de alquiler es obligatorio.");
    expectMessageFor(recordRentPaymentSchema, { ...validRentPayment, rentPeriodId: "   " }, ["rentPeriodId"], "El período de alquiler es obligatorio.");
    expectMessageFor(recordRentPaymentSchema, { ...validRentPayment, amount: "0" }, ["amount"], "El monto pagado debe ser mayor a cero.");
    expectMessageFor(recordRentPaymentSchema, { ...validRentPayment, amount: "12.345" }, ["amount"], "El monto pagado debe tener hasta dos decimales.");
    expectMessageFor(recordRentPaymentSchema, { ...validRentPayment, currency: "EUR" }, ["currency"], "La moneda no es válida.");
    expectMessageFor(recordRentPaymentSchema, { ...validRentPayment, paidAt: "bad-date" }, ["paidAt"], "La fecha de pago debe ser una fecha ISO válida.");
    expectMessageFor(recordRentPaymentSchema, { ...validRentPayment, notes: 42 }, ["notes"], "Las notas deben ser texto.");
    expectMessageFor(recordRentPaymentSchema, { ...validRentPayment, notes: "x".repeat(501) }, ["notes"], "Las notas no pueden superar los 500 caracteres.");
    expect(messagesFor(recordRentPaymentSchema, undefined)).toContain("Los datos del pago de alquiler son obligatorios.");
    expect(messagesFor(recordRentPaymentSchema, 42)).toContain("Los datos del pago de alquiler no son válidos.");

    const result = recordRentPaymentSchema.safeParse({
      ...validRentPayment,
      rentPeriodId: "  period-1  ",
      amount: 1500.75,
      notes: "  Partial payment.  ",
    });
    expect(result.success).toBe(true);
    expect(result.data?.rentPeriodId).toBe("period-1");
    expect(result.data?.amount).toBe("1500.75");
    expect(result.data?.notes).toBe("Partial payment.");
  });

  it("validates tenant balance movement period references, amounts, currency, and reason", () => {
    expectMessageFor(recordTenantBalanceMovementSchema, { ...validTenantBalanceMovement, rentPeriodId: 42 }, ["rentPeriodId"], "El período de alquiler debe ser texto.");
    expectMessageFor(recordTenantBalanceMovementSchema, { ...validTenantBalanceMovement, rentPeriodId: "   " }, ["rentPeriodId"], "El período de alquiler es obligatorio.");
    expectMessageFor(recordTenantBalanceMovementSchema, { ...validTenantBalanceMovement, paidAmount: "-1" }, ["paidAmount"], "El monto pagado debe tener hasta dos decimales.");
    expectMessageFor(recordTenantBalanceMovementSchema, { ...validTenantBalanceMovement, realAmount: "0" }, ["realAmount"], "El monto real debe ser mayor a cero.");
    expectMessageFor(recordTenantBalanceMovementSchema, { ...validTenantBalanceMovement, realAmount: "100.999" }, ["realAmount"], "El monto real debe tener hasta dos decimales.");
    expectMessageFor(recordTenantBalanceMovementSchema, { ...validTenantBalanceMovement, currency: "EUR" }, ["currency"], "La moneda no es válida.");
    expectMessageFor(recordTenantBalanceMovementSchema, { ...validTenantBalanceMovement, reason: 42 }, ["reason"], "El motivo debe ser texto.");
    expectMessageFor(recordTenantBalanceMovementSchema, { ...validTenantBalanceMovement, reason: "x".repeat(501) }, ["reason"], "El motivo no puede superar los 500 caracteres.");
    expect(messagesFor(recordTenantBalanceMovementSchema, undefined)).toContain("Los datos del saldo del inquilino son obligatorios.");
    expect(messagesFor(recordTenantBalanceMovementSchema, 42)).toContain("Los datos del saldo del inquilino no son válidos.");

    const zeroPaid = recordTenantBalanceMovementSchema.safeParse({ ...validTenantBalanceMovement, paidAmount: 0, reason: "  IPC settlement  " });
    expect(zeroPaid.success).toBe(true);
    expect(zeroPaid.data?.paidAmount).toBe("0");
    expect(zeroPaid.data?.reason).toBe("IPC settlement");
  });

  it("validates optional cash movement dates and rejects inverted date ranges", () => {
    expectMessageFor(listCashMovementsQuerySchema, { from: 42 }, ["from"], "La fecha desde debe ser texto.");
    expectMessageFor(listCashMovementsQuerySchema, { from: "   " }, ["from"], "La fecha desde es obligatoria.");
    expectMessageFor(listCashMovementsQuerySchema, { to: "bad-date" }, ["to"], "La fecha hasta debe ser una fecha ISO válida.");
    expectMessageFor(
      listCashMovementsQuerySchema,
      { from: "2026-05-11T00:00:00.000Z", to: "2026-05-10T00:00:00.000Z" },
      ["to"],
      "El rango de fechas no es válido.",
    );

    expect(listCashMovementsQuerySchema.safeParse({}).success).toBe(true);
    expect(listCashMovementsQuerySchema.safeParse({ from: "2026-05-10T00:00:00.000Z" }).success).toBe(true);
    expect(listCashMovementsQuerySchema.safeParse({ to: "2026-05-10T00:00:00.000Z" }).success).toBe(true);
    expect(listCashMovementsQuerySchema.safeParse({ from: "2026-05-10T00:00:00.000Z", to: "2026-05-10T00:00:00.000Z" }).success).toBe(true);
  });
});
