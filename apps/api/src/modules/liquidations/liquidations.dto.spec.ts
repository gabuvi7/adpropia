import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  addManualAdjustmentSchema,
  changeLiquidationStatusSchema,
  createLiquidationSchema,
  listLiquidationsQuerySchema,
  ownerSettlementInputsSchema,
  previewLiquidationSchema,
  updateLiquidationDraftSchema,
} from "./liquidations.dto";

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

function expectRejectedAt(schema: SchemaUnderTest, input: unknown, path: PropertyKey[]) {
  const result = schema.safeParse(input);

  expect(result.success).toBe(false);

  if (!result.success) {
    expect(result.error.issues.some((issue) => issue.path.join(".") === path.join("."))).toBe(true);
  }
}

const validPeriod = {
  ownerId: "owner-1",
  periodStart: "2026-05-01T00:00:00.000Z",
  periodEnd: "2026-06-01T00:00:00.000Z",
  currency: "ARS",
};

const validManualAdjustment = {
  concept: "Late fee",
  amount: "1000.50",
  sign: "DEBIT",
};

describe("liquidations DTO validation", () => {
  it("rejects missing, invalid type, empty, and whitespace-only owner ids while trimming accepted ids", () => {
    expectMessageFor(previewLiquidationSchema, { ...validPeriod, ownerId: undefined }, ["ownerId"], "El propietario es obligatorio.");
    expectMessageFor(previewLiquidationSchema, { ...validPeriod, ownerId: 42 }, ["ownerId"], "El propietario debe ser texto.");
    expectMessageFor(previewLiquidationSchema, { ...validPeriod, ownerId: "" }, ["ownerId"], "El propietario es obligatorio.");
    expectMessageFor(createLiquidationSchema, { ...validPeriod, ownerId: "   " }, ["ownerId"], "El propietario es obligatorio.");

    const result = createLiquidationSchema.safeParse({
      ...validPeriod,
      ownerId: "  owner-1  ",
    });

    expect(result.success).toBe(true);
    expect(result.data?.ownerId).toBe("owner-1");
  });

  it("validates period dates, chronological constraints, currency, and object-level messages in Spanish", () => {
    expectMessageFor(previewLiquidationSchema, { ...validPeriod, periodStart: undefined }, ["periodStart"], "La fecha de inicio del período es obligatoria.");
    expectMessageFor(previewLiquidationSchema, { ...validPeriod, periodStart: 42 }, ["periodStart"], "La fecha de inicio del período debe ser texto.");
    expectMessageFor(previewLiquidationSchema, { ...validPeriod, periodStart: "   " }, ["periodStart"], "La fecha de inicio del período es obligatoria.");
    expectMessageFor(previewLiquidationSchema, { ...validPeriod, periodEnd: "bad-date" }, ["periodEnd"], "La fecha de fin del período debe ser una fecha ISO válida.");
    expectMessageFor(previewLiquidationSchema, { ...validPeriod, currency: "EUR" }, ["currency"], "La moneda no es válida.");
    expectMessageFor(
      previewLiquidationSchema,
      {
        ...validPeriod,
        periodStart: "2026-06-01T00:00:00.000Z",
        periodEnd: "2026-06-01T00:00:00.000Z",
      },
      ["periodEnd"],
      "El período no es válido: la fecha de inicio debe ser anterior al fin.",
    );
    expectMessageFor(
      createLiquidationSchema,
      {
        ...validPeriod,
        periodStart: "2026-06-01T00:00:00.000Z",
        periodEnd: "2026-06-01T00:00:00.000Z",
      },
      ["periodEnd"],
      "El período no es válido: la fecha de inicio debe ser anterior al fin.",
    );
    expectMessageFor(
      createLiquidationSchema,
      {
        ...validPeriod,
        periodStart: "2026-06-02T00:00:00.000Z",
        periodEnd: "2026-06-01T00:00:00.000Z",
      },
      ["periodEnd"],
      "El período no es válido: la fecha de inicio debe ser anterior al fin.",
    );
    expect(messagesFor(createLiquidationSchema, undefined)).toContain("Las fechas del período son obligatorias y deben tener formato ISO.");
    expect(messagesFor(createLiquidationSchema, 42)).toContain("Los datos de la liquidación no son válidos.");

    const result = previewLiquidationSchema.safeParse({
      ...validPeriod,
      periodStart: "  2026-05-01T00:00:00.000Z  ",
      periodEnd: "  2026-06-01T00:00:00.000Z  ",
      currency: "USD",
    });

    expect(result.success).toBe(true);
    expect(result.data?.periodStart).toBe("2026-05-01T00:00:00.000Z");
    expect(result.data?.periodEnd).toBe("2026-06-01T00:00:00.000Z");
    expect(result.data?.currency).toBe("USD");
  });

  it("validates create notes and nested manual adjustments with Spanish messages and normalized output", () => {
    expectMessageFor(createLiquidationSchema, { ...validPeriod, notes: 42 }, ["notes"], "Las observaciones deben ser texto.");
    expectMessageFor(createLiquidationSchema, { ...validPeriod, notes: "x".repeat(2001) }, ["notes"], "Las observaciones no pueden superar los 2000 caracteres.");
    expectMessageFor(createLiquidationSchema, { ...validPeriod, manualAdjustments: 42 }, ["manualAdjustments"], "Los ajustes manuales deben ser una lista.");
    expectMessageFor(createLiquidationSchema, { ...validPeriod, manualAdjustments: [undefined] }, ["manualAdjustments", 0], "Los datos del ajuste son obligatorios.");
    expectMessageFor(createLiquidationSchema, { ...validPeriod, manualAdjustments: [42] }, ["manualAdjustments", 0], "Los datos del ajuste no son válidos.");
    expectMessageFor(createLiquidationSchema, { ...validPeriod, manualAdjustments: [{ ...validManualAdjustment, concept: undefined }] }, ["manualAdjustments", 0, "concept"], "El concepto del ajuste es obligatorio.");
    expectMessageFor(createLiquidationSchema, { ...validPeriod, manualAdjustments: [{ ...validManualAdjustment, concept: "   " }] }, ["manualAdjustments", 0, "concept"], "El concepto del ajuste es obligatorio.");
    expectMessageFor(createLiquidationSchema, { ...validPeriod, manualAdjustments: [{ ...validManualAdjustment, concept: 42 }] }, ["manualAdjustments", 0, "concept"], "El concepto del ajuste debe ser texto.");
    expectMessageFor(createLiquidationSchema, { ...validPeriod, manualAdjustments: [{ ...validManualAdjustment, concept: "x".repeat(201) }] }, ["manualAdjustments", 0, "concept"], "El concepto del ajuste no puede superar los 200 caracteres.");
    expectMessageFor(createLiquidationSchema, { ...validPeriod, manualAdjustments: [{ ...validManualAdjustment, amount: "0" }] }, ["manualAdjustments", 0, "amount"], "El monto del ajuste debe ser mayor a cero.");
    expectMessageFor(createLiquidationSchema, { ...validPeriod, manualAdjustments: [{ ...validManualAdjustment, amount: "100.999" }] }, ["manualAdjustments", 0, "amount"], "El monto del ajuste debe tener hasta dos decimales.");
    expectMessageFor(createLiquidationSchema, { ...validPeriod, manualAdjustments: [{ ...validManualAdjustment, amount: 100.999 }] }, ["manualAdjustments", 0, "amount"], "El monto del ajuste debe tener hasta dos decimales.");
    expectRejectedAt(createLiquidationSchema, { ...validPeriod, manualAdjustments: [{ ...validManualAdjustment, amount: Number.POSITIVE_INFINITY }] }, ["manualAdjustments", 0, "amount"]);
    expectMessageFor(createLiquidationSchema, { ...validPeriod, manualAdjustments: [{ ...validManualAdjustment, sign: "PLUS" }] }, ["manualAdjustments", 0, "sign"], "El signo del ajuste no es válido.");

    const defaultAdjustments = createLiquidationSchema.safeParse(validPeriod);
    expect(defaultAdjustments.success).toBe(true);
    expect(defaultAdjustments.data?.manualAdjustments).toEqual([]);

    const result = createLiquidationSchema.safeParse({
      ...validPeriod,
      notes: "  Owner requested a manual review.  ",
      manualAdjustments: [{ concept: "  Cleaning fee  ", amount: "  1200  ", sign: "CREDIT" }],
    });

    expect(result.success).toBe(true);
    expect(result.data?.notes).toBe("Owner requested a manual review.");
    expect(result.data?.manualAdjustments[0]).toEqual({ concept: "Cleaning fee", amount: "1200", sign: "CREDIT" });
  });

  it("validates owner settlement inputs and optional period boundaries", () => {
    expectMessageFor(ownerSettlementInputsSchema, { contractId: undefined }, ["contractId"], "El contrato es obligatorio.");
    expectMessageFor(ownerSettlementInputsSchema, { contractId: 42 }, ["contractId"], "El contrato debe ser texto.");
    expectMessageFor(ownerSettlementInputsSchema, { contractId: "   " }, ["contractId"], "El contrato es obligatorio.");
    expectMessageFor(ownerSettlementInputsSchema, { contractId: "contract-1", periodStart: "bad-date" }, ["periodStart"], "La fecha de inicio del período debe ser una fecha ISO válida.");
    expectMessageFor(ownerSettlementInputsSchema, { contractId: "contract-1", periodEnd: "   " }, ["periodEnd"], "La fecha de fin del período es obligatoria.");
    expect(messagesFor(ownerSettlementInputsSchema, undefined)).toContain("Los datos del contrato son obligatorios.");
    expect(messagesFor(ownerSettlementInputsSchema, 42)).toContain("Los datos para calcular la liquidación no son válidos.");

    const result = ownerSettlementInputsSchema.safeParse({
      contractId: "  contract-1  ",
      periodStart: "  2026-05-01T00:00:00.000Z  ",
    });

    expect(result.success).toBe(true);
    expect(result.data?.contractId).toBe("contract-1");
    expect(result.data?.periodStart).toBe("2026-05-01T00:00:00.000Z");
  });

  it("validates list filters, optional date range semantics, and trims accepted query values", () => {
    expectRejectedAt(listLiquidationsQuerySchema, { ownerId: "   " }, ["ownerId"]);
    expectMessageFor(listLiquidationsQuerySchema, { status: "ARCHIVED" }, ["status"], "El estado de la liquidación no es válido.");
    expectMessageFor(listLiquidationsQuerySchema, { currency: "EUR" }, ["currency"], "La moneda no es válida.");
    expectMessageFor(listLiquidationsQuerySchema, { periodStart: 42 }, ["periodStart"], "La fecha de inicio del período debe ser texto.");
    expectMessageFor(listLiquidationsQuerySchema, { periodEnd: "bad-date" }, ["periodEnd"], "La fecha de fin del período debe ser una fecha ISO válida.");
    expectMessageFor(
      listLiquidationsQuerySchema,
      { periodStart: "2026-06-01T00:00:00.000Z", periodEnd: "2026-06-01T00:00:00.000Z" },
      ["periodEnd"],
      "El período no es válido.",
    );
    expectMessageFor(
      listLiquidationsQuerySchema,
      { periodStart: "2026-06-02T00:00:00.000Z", periodEnd: "2026-06-01T00:00:00.000Z" },
      ["periodEnd"],
      "El período no es válido.",
    );

    expect(listLiquidationsQuerySchema.safeParse({}).success).toBe(true);
    expect(listLiquidationsQuerySchema.safeParse({ periodStart: "2026-05-01T00:00:00.000Z" }).success).toBe(true);
    expect(listLiquidationsQuerySchema.safeParse({ periodEnd: "2026-06-01T00:00:00.000Z" }).success).toBe(true);

    const result = listLiquidationsQuerySchema.safeParse({
      ownerId: "  owner-1  ",
      status: "ISSUED",
      currency: "USD",
      periodStart: "  2026-05-01T00:00:00.000Z  ",
      periodEnd: "  2026-06-01T00:00:00.000Z  ",
    });

    expect(result.success).toBe(true);
    expect(result.data?.ownerId).toBe("owner-1");
    expect(result.data?.periodStart).toBe("2026-05-01T00:00:00.000Z");
    expect(result.data?.periodEnd).toBe("2026-06-01T00:00:00.000Z");
  });

  it("validates update draft notes and change-status status/void reason constraints", () => {
    expectMessageFor(updateLiquidationDraftSchema, { notes: 42 }, ["notes"], "Las observaciones deben ser texto.");
    expectMessageFor(updateLiquidationDraftSchema, { notes: "x".repeat(2001) }, ["notes"], "Las observaciones no pueden superar los 2000 caracteres.");
    expectMessageFor(changeLiquidationStatusSchema, { status: "ARCHIVED" }, ["status"], "El estado de la liquidación no es válido.");
    expectMessageFor(changeLiquidationStatusSchema, { status: "VOIDED", voidReason: 42 }, ["voidReason"], "El motivo de anulación debe ser texto.");
    expectMessageFor(changeLiquidationStatusSchema, { status: "VOIDED", voidReason: "   " }, ["voidReason"], "Es necesario indicar un motivo de anulación.");
    expectMessageFor(changeLiquidationStatusSchema, { status: "VOIDED", voidReason: "x".repeat(501) }, ["voidReason"], "El motivo de anulación no puede superar los 500 caracteres.");

    const updateResult = updateLiquidationDraftSchema.safeParse({ notes: "  Ready to issue.  " });
    expect(updateResult.success).toBe(true);
    expect(updateResult.data?.notes).toBe("Ready to issue.");

    const statusResult = changeLiquidationStatusSchema.safeParse({ status: "VOIDED", voidReason: "  Duplicated liquidation.  " });
    expect(statusResult.success).toBe(true);
    expect(statusResult.data?.voidReason).toBe("Duplicated liquidation.");
  });

  it("validates standalone manual adjustment concept, amount, and sign", () => {
    expectMessageFor(addManualAdjustmentSchema, { ...validManualAdjustment, concept: undefined }, ["concept"], "El concepto del ajuste es obligatorio.");
    expectMessageFor(addManualAdjustmentSchema, { ...validManualAdjustment, concept: 42 }, ["concept"], "El concepto del ajuste debe ser texto.");
    expectMessageFor(addManualAdjustmentSchema, { ...validManualAdjustment, concept: "   " }, ["concept"], "El concepto del ajuste es obligatorio.");
    expectMessageFor(addManualAdjustmentSchema, { ...validManualAdjustment, concept: "x".repeat(201) }, ["concept"], "El concepto no puede superar los 200 caracteres.");
    expectMessageFor(addManualAdjustmentSchema, { ...validManualAdjustment, amount: 0 }, ["amount"], "El monto del ajuste debe ser mayor a cero.");
    expectMessageFor(addManualAdjustmentSchema, { ...validManualAdjustment, amount: "-1" }, ["amount"], "El monto del ajuste debe tener hasta dos decimales.");
    expectMessageFor(addManualAdjustmentSchema, { ...validManualAdjustment, amount: "100.999" }, ["amount"], "El monto del ajuste debe tener hasta dos decimales.");
    expectMessageFor(addManualAdjustmentSchema, { ...validManualAdjustment, amount: 100.999 }, ["amount"], "El monto del ajuste debe tener hasta dos decimales.");
    expectMessageFor(addManualAdjustmentSchema, { ...validManualAdjustment, amount: "100x" }, ["amount"], "El monto del ajuste debe tener hasta dos decimales.");
    expectMessageFor(addManualAdjustmentSchema, { ...validManualAdjustment, amount: "x100" }, ["amount"], "El monto del ajuste debe tener hasta dos decimales.");
    expectMessageFor(addManualAdjustmentSchema, { ...validManualAdjustment, sign: "PLUS" }, ["sign"], "El signo del ajuste no es válido.");

    const result = addManualAdjustmentSchema.safeParse({
      concept: "  Extraordinary repair  ",
      amount: "  1000  ",
      sign: "DEBIT",
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ concept: "Extraordinary repair", amount: "1000", sign: "DEBIT" });
  });
});
