import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  activateContractScheduleSchema,
  changeContractStatusSchema,
  createContractSchema,
  createContractStructureSchema,
  defineContractDepositSchema,
  finalizeContractEarlySchema,
  registerContractGuaranteeSchema,
  updateContractSchema,
} from "./contracts.dto";

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

const validContract = {
  propertyId: "property-1",
  ownerId: "owner-1",
  renterId: "tenant-1",
  startsAt: "2026-01-01",
  endsAt: "2027-01-01",
  rentAmount: "1000.50",
  currency: "ARS",
  dueDayOfMonth: 10,
  adjustmentIndexType: "IPC",
  adjustmentPeriodMonths: 3,
};

const validContractStructure = {
  participantPersonaIds: ["persona-1", "persona-2"],
  properties: [{ propertyId: "property-1", monthlyAmount: "1000" }],
  startsAt: "2026-01-01",
  endsAt: "2027-01-01",
  monthlyTotalAmount: "1000",
  currency: "ARS",
  dueDayOfMonth: 10,
  adjustmentIndexType: "IPC",
  adjustmentPeriodMonths: 6,
  commissionBps: 500,
};

describe("contract DTO validation", () => {
  it("rejects missing, invalid type, empty, and whitespace-only required contract ids", () => {
    expectMessageFor(
      createContractSchema,
      { ...validContract, propertyId: undefined },
      ["propertyId"],
      "La propiedad es obligatorio.",
    );
    expectMessageFor(
      createContractSchema,
      { ...validContract, propertyId: 42 },
      ["propertyId"],
      "La propiedad debe ser texto.",
    );
    expectMessageFor(
      createContractSchema,
      { ...validContract, propertyId: "" },
      ["propertyId"],
      "La propiedad es obligatorio.",
    );
    expectMessageFor(
      createContractSchema,
      { ...validContract, ownerId: "   " },
      ["ownerId"],
      "El propietario es obligatorio.",
    );
    expectMessageFor(
      createContractSchema,
      { ...validContract, renterId: "   " },
      ["renterId"],
      "El inquilino es obligatorio.",
    );

    const result = createContractSchema.safeParse({
      ...validContract,
      propertyId: "  property-1  ",
      ownerId: "  owner-1  ",
      renterId: "  tenant-1  ",
    });
    expect(result.success).toBe(true);
    expect(result.data?.propertyId).toBe("property-1");
    expect(result.data?.ownerId).toBe("owner-1");
    expect(result.data?.renterId).toBe("tenant-1");
  });

  it("validates contract enum values with Spanish API-facing messages", () => {
    expectMessageFor(createContractSchema, { ...validContract, status: "SIGNED" }, ["status"], "El estado del contrato no es válido.");
    expectMessageFor(createContractSchema, { ...validContract, currency: "EUR" }, ["currency"], "La moneda no es válida.");
    expectMessageFor(createContractSchema, { ...validContract, adjustmentIndexType: "BAD" }, ["adjustmentIndexType"], "El índice de ajuste no es válido.");
    expectMessageFor(changeContractStatusSchema, { status: "ARCHIVED" }, ["status"], "El estado del contrato no es válido.");
    expectMessageFor(finalizeContractEarlySchema, { finalizedAt: "2026-06-01", finalizationReason: "BAD" }, ["finalizationReason"], "El motivo de finalización no es válido.");
    expectMessageFor(registerContractGuaranteeSchema, { type: "BAD" }, ["type"], "El tipo de garantía no es válido.");
    expectMessageFor(registerContractGuaranteeSchema, { type: "SURETY", state: "BAD" }, ["state"], "El estado de la garantía no es válido.");
    expectMessageFor(defineContractDepositSchema, { amount: "1000", currency: "EUR" }, ["currency"], "La moneda no es válida.");

    expect(createContractSchema.safeParse({ ...validContract, status: "ACTIVE" }).success).toBe(true);
    expect(createContractStructureSchema.safeParse({ ...validContractStructure, status: "PENDING_SIGNATURE" }).success).toBe(true);
    expect(registerContractGuaranteeSchema.safeParse({ type: "SURETY", state: "RELEASED" }).success).toBe(true);
  });

  it("validates rent amount shape, positivity, and numeric input", () => {
    expectMessageFor(createContractSchema, { ...validContract, rentAmount: "100.999" }, ["rentAmount"], "El monto del alquiler debe tener hasta dos decimales.");
    expectMessageFor(createContractSchema, { ...validContract, rentAmount: "0" }, ["rentAmount"], "El monto del alquiler debe ser mayor a cero.");
    expect(createContractSchema.safeParse({ ...validContract, rentAmount: -1 }).success).toBe(false);
    expectMessageFor(defineContractDepositSchema, { amount: "0", currency: "ARS" }, ["amount"], "El monto del alquiler debe ser mayor a cero.");

    const result = createContractSchema.safeParse({ ...validContract, rentAmount: 1200.5 });
    expect(result.success).toBe(true);
    expect(result.data?.rentAmount).toBe("1200.5");
  });

  it("validates date fields and chronological contract ranges", () => {
    expectMessageFor(createContractSchema, { ...validContract, startsAt: "" }, ["startsAt"], "La fecha de inicio es obligatoria.");
    expectMessageFor(createContractSchema, { ...validContract, startsAt: 42 }, ["startsAt"], "La fecha de inicio debe ser texto.");
    expectMessageFor(createContractSchema, { ...validContract, endsAt: undefined }, ["endsAt"], "La fecha de finalización es obligatoria.");
    expectMessageFor(createContractSchema, { ...validContract, nextAdjustmentAt: "not-a-date" }, ["nextAdjustmentAt"], "La próxima fecha de ajuste debe ser una fecha ISO válida.");
    expectMessageFor(createContractSchema, { ...validContract, startsAt: "2027-01-01", endsAt: "2026-01-01" }, ["endsAt"], "La fecha de inicio debe ser anterior a la fecha de finalización.");
    expectMessageFor(createContractSchema, { ...validContract, startsAt: "2026-01-01", endsAt: "2026-01-01" }, ["endsAt"], "La fecha de inicio debe ser anterior a la fecha de finalización.");
    expectMessageFor(finalizeContractEarlySchema, { finalizedAt: "bad-date", finalizationReason: "OTHER" }, ["finalizedAt"], "La fecha de finalización debe ser una fecha ISO válida.");
  });

  it("validates due day and adjustment period numeric boundaries", () => {
    expectMessageFor(createContractSchema, { ...validContract, dueDayOfMonth: undefined }, ["dueDayOfMonth"], "El día de vencimiento es obligatorio.");
    expectMessageFor(createContractSchema, { ...validContract, dueDayOfMonth: 0 }, ["dueDayOfMonth"], "El día de vencimiento debe estar entre 1 y 31.");
    expectMessageFor(createContractSchema, { ...validContract, dueDayOfMonth: 32 }, ["dueDayOfMonth"], "El día de vencimiento debe estar entre 1 y 31.");
    expectMessageFor(createContractSchema, { ...validContract, dueDayOfMonth: 10.5 }, ["dueDayOfMonth"], "El día de vencimiento debe ser un número entero.");
    expectMessageFor(createContractSchema, { ...validContract, dueDayOfMonth: "10" }, ["dueDayOfMonth"], "El día de vencimiento debe ser un número.");
    expectMessageFor(createContractSchema, { ...validContract, adjustmentPeriodMonths: undefined }, ["adjustmentPeriodMonths"], "El período de ajuste es obligatorio.");
    expectMessageFor(createContractSchema, { ...validContract, adjustmentPeriodMonths: 0 }, ["adjustmentPeriodMonths"], "El período de ajuste debe ser positivo.");
    expectMessageFor(createContractSchema, { ...validContract, adjustmentPeriodMonths: 1.5 }, ["adjustmentPeriodMonths"], "El período de ajuste debe ser un número entero.");
    expectMessageFor(createContractSchema, { ...validContract, adjustmentPeriodMonths: "6" }, ["adjustmentPeriodMonths"], "El período de ajuste debe ser un número.");
  });

  it("reports Spanish messages for missing or invalid DTO object bodies", () => {
    expect(messagesFor(createContractSchema, undefined)).toContain("Los datos del contrato son obligatorios.");
    expect(messagesFor(createContractSchema, 42)).toContain("Los datos del contrato no son válidos.");
    expect(messagesFor(createContractStructureSchema, undefined)).toContain("Los datos de la estructura del contrato son obligatorios.");
    expect(messagesFor(createContractStructureSchema, 42)).toContain("Los datos de la estructura del contrato no son válidos.");
    expect(messagesFor(changeContractStatusSchema, undefined)).toContain("El estado del contrato es obligatorio.");
    expect(messagesFor(changeContractStatusSchema, 42)).toContain("El estado del contrato no es válido.");
  });

  it("rejects empty updates while accepting partial valid contract changes", () => {
    expect(messagesFor(updateContractSchema, {})).toContain("Tenés que enviar al menos un dato para actualizar.");
    expectMessageFor(updateContractSchema, { ownerId: "   " }, ["ownerId"], "El propietario es obligatorio.");
    expectMessageFor(updateContractSchema, { currency: "EUR" }, ["currency"], "La moneda no es válida.");
    expectMessageFor(updateContractSchema, { endsAt: "" }, ["endsAt"], "La fecha de finalización es obligatoria.");

    const result = updateContractSchema.safeParse({ dueDayOfMonth: 15 });
    expect(result.success).toBe(true);
  });

  it("validates structured contract participants, properties, and commission", () => {
    expectMessageFor(createContractStructureSchema, { ...validContractStructure, participantPersonaIds: [] }, ["participantPersonaIds"], "Tenés que indicar al menos una persona participante.");
    expectMessageFor(createContractStructureSchema, { ...validContractStructure, participantPersonaIds: 42 }, ["participantPersonaIds"], "Los participantes deben ser una lista.");
    expectMessageFor(createContractStructureSchema, { ...validContractStructure, participantPersonaIds: ["   "] }, ["participantPersonaIds", 0], "La persona participante es obligatorio.");
    expectMessageFor(createContractStructureSchema, { ...validContractStructure, properties: [] }, ["properties"], "Tenés que indicar al menos una propiedad.");
    expectMessageFor(createContractStructureSchema, { ...validContractStructure, properties: 42 }, ["properties"], "Las propiedades deben ser una lista.");
    expectMessageFor(createContractStructureSchema, { ...validContractStructure, properties: [{ propertyId: "   " }] }, ["properties", 0, "propertyId"], "La propiedad es obligatorio.");
    expectMessageFor(createContractStructureSchema, { ...validContractStructure, status: "BAD" }, ["status"], "El estado del contrato no es válido.");
    expectMessageFor(createContractStructureSchema, { ...validContractStructure, startsAt: "" }, ["startsAt"], "La fecha de inicio es obligatoria.");
    expectMessageFor(createContractStructureSchema, { ...validContractStructure, endsAt: "" }, ["endsAt"], "La fecha de finalización es obligatoria.");
    expectMessageFor(createContractStructureSchema, { ...validContractStructure, commissionBps: -1 }, ["commissionBps"], "La comisión del contrato no puede ser negativa.");
    expectMessageFor(createContractStructureSchema, { ...validContractStructure, commissionBps: 10001 }, ["commissionBps"], "La comisión del contrato no puede superar el 100%.");
    expectMessageFor(createContractStructureSchema, { ...validContractStructure, commissionBps: 10.5 }, ["commissionBps"], "La comisión del contrato debe ser un número entero.");
    expectMessageFor(createContractStructureSchema, { ...validContractStructure, commissionBps: "500" }, ["commissionBps"], "La comisión del contrato debe ser un número.");
    expectMessageFor(createContractStructureSchema, { ...validContractStructure, dueDayOfMonth: 10.5 }, ["dueDayOfMonth"], "El día de vencimiento debe ser un número entero.");
    expectMessageFor(createContractStructureSchema, { ...validContractStructure, dueDayOfMonth: 0 }, ["dueDayOfMonth"], "El día de vencimiento debe estar entre 1 y 31.");
    expectMessageFor(createContractStructureSchema, { ...validContractStructure, dueDayOfMonth: 32 }, ["dueDayOfMonth"], "El día de vencimiento debe estar entre 1 y 31.");
    expectMessageFor(createContractStructureSchema, { ...validContractStructure, dueDayOfMonth: "10" }, ["dueDayOfMonth"], "El día de vencimiento debe ser un número.");
    expectMessageFor(createContractStructureSchema, { ...validContractStructure, adjustmentPeriodMonths: 1.5 }, ["adjustmentPeriodMonths"], "El período de ajuste debe ser un número entero.");
    expectMessageFor(createContractStructureSchema, { ...validContractStructure, adjustmentPeriodMonths: 0 }, ["adjustmentPeriodMonths"], "El período de ajuste debe ser positivo.");
    expectMessageFor(createContractStructureSchema, { ...validContractStructure, adjustmentPeriodMonths: "6" }, ["adjustmentPeriodMonths"], "El período de ajuste debe ser un número.");
    expectMessageFor(createContractStructureSchema, { ...validContractStructure, nextAdjustmentAt: "bad-date" }, ["nextAdjustmentAt"], "La próxima fecha de ajuste debe ser una fecha ISO válida.");
    expectMessageFor(createContractStructureSchema, { ...validContractStructure, previousContractId: "   " }, ["previousContractId"], "El contrato anterior es obligatorio.");
    expectMessageFor(createContractStructureSchema, { ...validContractStructure, startsAt: "2027-01-01", endsAt: "2026-01-01" }, ["endsAt"], "La fecha de inicio debe ser anterior a la fecha de finalización.");
    expectMessageFor(createContractStructureSchema, { ...validContractStructure, startsAt: "2026-01-01", endsAt: "2026-01-01" }, ["endsAt"], "La fecha de inicio debe ser anterior a la fecha de finalización.");
  });

  it("validates activation schedule optional estimated fields", () => {
    expectMessageFor(activateContractScheduleSchema, { activatedAt: "" }, ["activatedAt"], "La fecha de activación es obligatoria.");
    expectMessageFor(activateContractScheduleSchema, { activatedAt: "bad-date" }, ["activatedAt"], "La fecha de activación debe ser una fecha ISO válida.");
    expectMessageFor(activateContractScheduleSchema, { activatedAt: "2026-01-01", estimatedAmount: "0" }, ["estimatedAmount"], "El monto del alquiler debe ser mayor a cero.");
    expectMessageFor(activateContractScheduleSchema, { activatedAt: "2026-01-01", estimatedIndexValue: 42 }, ["estimatedIndexValue"], "El índice estimado debe ser texto.");
    expectMessageFor(activateContractScheduleSchema, { activatedAt: "2026-01-01", estimatedIndexValue: "   " }, ["estimatedIndexValue"], "El índice estimado es obligatorio.");
    expectMessageFor(activateContractScheduleSchema, { activatedAt: "2026-01-01", estimatedIndexSource: 42 }, ["estimatedIndexSource"], "La fuente del índice estimado debe ser texto.");
    expectMessageFor(activateContractScheduleSchema, { activatedAt: "2026-01-01", estimatedIndexSource: "   " }, ["estimatedIndexSource"], "La fuente del índice estimado es obligatoria.");

    const result = activateContractScheduleSchema.safeParse({ activatedAt: "2026-01-01", estimatedIndexValue: "  1.5  ", estimatedIndexSource: "  source-name  " });
    expect(result.success).toBe(true);
    expect(result.data?.estimatedIndexValue).toBe("1.5");
    expect(result.data?.estimatedIndexSource).toBe("source-name");
  });

  it("validates guarantee variants and nested required fields", () => {
    expectMessageFor(registerContractGuaranteeSchema, { type: "SALARY_RECEIPT", salaryReceipt: { employerName: "   ", employeeName: "Jane" } }, ["salaryReceipt", "employerName"], "El empleador es obligatorio.");
    expectMessageFor(registerContractGuaranteeSchema, { type: "SALARY_RECEIPT", salaryReceipt: { employerName: "ACME", employeeName: 42 } }, ["salaryReceipt", "employeeName"], "La persona empleada debe ser texto.");
    expectMessageFor(registerContractGuaranteeSchema, { type: "SALARY_RECEIPT", salaryReceipt: { employerName: "ACME", employeeName: "Jane", employeeTaxId: "   ", employmentDate: "bad-date" } }, ["salaryReceipt", "employeeTaxId"], "El CUIT/CUIL de la persona empleada es obligatorio.");
    expectMessageFor(registerContractGuaranteeSchema, { type: "SALARY_RECEIPT", salaryReceipt: { employerName: "ACME", employeeName: "Jane", employmentDate: "bad-date" } }, ["salaryReceipt", "employmentDate"], "La fecha de ingreso laboral debe ser una fecha ISO válida.");
    expectMessageFor(registerContractGuaranteeSchema, { type: "PROPERTY_BACKED", propertyBacked: { cadastralNomenclature: "NOM", registrationNumber: "REG", registrationLocality: "City", propertyAddress: "Address", titleHolders: [] } }, ["propertyBacked", "titleHolders"], "La garantía propietaria debe tener al menos un titular registral.");
    expectMessageFor(registerContractGuaranteeSchema, { type: "PROPERTY_BACKED", propertyBacked: { cadastralNomenclature: "NOM", registrationNumber: "REG", registrationLocality: "City", propertyAddress: "Address", titleHolders: 42 } }, ["propertyBacked", "titleHolders"], "Los titulares registrales deben ser una lista.");
    expectMessageFor(registerContractGuaranteeSchema, { type: "PROPERTY_BACKED", propertyBacked: { cadastralNomenclature: "NOM", registrationNumber: "REG", registrationLocality: "City", propertyAddress: "Address", titleHolders: [{ fullName: "Owner", signsGuarantee: "yes" }] } }, ["propertyBacked", "titleHolders", 0, "signsGuarantee"], "Tenés que indicar si el titular firma la garantía.");
    expectMessageFor(registerContractGuaranteeSchema, { type: "PROPERTY_BACKED", propertyBacked: { cadastralNomenclature: "NOM", registrationNumber: "REG", registrationLocality: "City", propertyAddress: "Address", titleHolders: [{ fullName: "   ", signsGuarantee: true }] } }, ["propertyBacked", "titleHolders", 0, "fullName"], "El nombre del titular registral es obligatorio.");
    expectMessageFor(registerContractGuaranteeSchema, { type: "PROPERTY_BACKED", propertyBacked: { cadastralNomenclature: "   ", registrationNumber: "REG", registrationLocality: "City", propertyAddress: "Address", titleHolders: [{ fullName: "Owner", signsGuarantee: true }] } }, ["propertyBacked", "cadastralNomenclature"], "La nomenclatura catastral es obligatorio.");
    expectMessageFor(registerContractGuaranteeSchema, { type: "PROPERTY_BACKED", propertyBacked: { cadastralNomenclature: "NOM", registrationNumber: "   ", registrationLocality: "City", propertyAddress: "Address", titleHolders: [{ fullName: "Owner", signsGuarantee: true }] } }, ["propertyBacked", "registrationNumber"], "La matrícula es obligatorio.");
    expectMessageFor(registerContractGuaranteeSchema, { type: "PROPERTY_BACKED", propertyBacked: { cadastralNomenclature: "NOM", registrationNumber: "REG", registrationLocality: "   ", propertyAddress: "Address", titleHolders: [{ fullName: "Owner", signsGuarantee: true }] } }, ["propertyBacked", "registrationLocality"], "La localidad registral es obligatorio.");
    expectMessageFor(registerContractGuaranteeSchema, { type: "PROPERTY_BACKED", propertyBacked: { cadastralNomenclature: "NOM", registrationNumber: "REG", registrationLocality: "City", propertyAddress: "   ", titleHolders: [{ fullName: "Owner", signsGuarantee: true }] } }, ["propertyBacked", "propertyAddress"], "El domicilio de la garantía es obligatorio.");
    expectMessageFor(registerContractGuaranteeSchema, { type: "SURETY", surety: { companyName: "   ", policyNumber: "P-1" } }, ["surety", "companyName"], "La compañía de caución es obligatorio.");
    expectMessageFor(registerContractGuaranteeSchema, { type: "SURETY", surety: { companyName: "Surety", policyNumber: "   " } }, ["surety", "policyNumber"], "La póliza es obligatorio.");
    expectMessageFor(registerContractGuaranteeSchema, { type: "SURETY", surety: { companyName: "Surety", policyNumber: "P-1", coverageAmount: "0" } }, ["surety", "coverageAmount"], "El monto del alquiler debe ser mayor a cero.");
    expectMessageFor(registerContractGuaranteeSchema, { type: "SURETY", startsAt: "bad-date" }, ["startsAt"], "La fecha de inicio de la garantía debe ser una fecha ISO válida.");
    expectMessageFor(registerContractGuaranteeSchema, { type: "SURETY", endsAt: "bad-date" }, ["endsAt"], "La fecha de fin de la garantía debe ser una fecha ISO válida.");
    expectMessageFor(registerContractGuaranteeSchema, { type: "SURETY", notes: "x".repeat(501) }, ["notes"], "Las notas no pueden superar los 500 caracteres.");

    const result = registerContractGuaranteeSchema.safeParse({ type: "SURETY", notes: `${" ".repeat(500)}ok` });
    expect(result.success).toBe(true);
    expect(result.data?.notes).toBe("ok");
  });

  it("validates deposit and finalization notes and descriptions", () => {
    expectMessageFor(defineContractDepositSchema, { amount: "1000", currency: "ARS", receivedAt: "bad-date" }, ["receivedAt"], "La fecha de recepción del depósito debe ser una fecha ISO válida.");
    expectMessageFor(defineContractDepositSchema, { amount: "1000", currency: "ARS", notes: 42 }, ["notes"], "Las notas deben ser texto.");
    expectMessageFor(defineContractDepositSchema, { amount: "1000", currency: "ARS", notes: "x".repeat(501) }, ["notes"], "Las notas no pueden superar los 500 caracteres.");
    expectMessageFor(finalizeContractEarlySchema, { finalizedAt: "2026-06-01", finalizationReason: "OTHER", finalizationDescription: "   " }, ["finalizationDescription"], "La descripción es obligatoria.");
    expectMessageFor(finalizeContractEarlySchema, { finalizedAt: "2026-06-01", finalizationReason: "OTHER", finalizationDescription: 42 }, ["finalizationDescription"], "La descripción debe ser texto.");
  });
});
