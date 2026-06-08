import { z } from "zod";

const requiredMessage = (required: string, invalidType: string) => (issue: { input: unknown }) =>
  issue.input === undefined ? required : invalidType;

const rentalContractStatusSchema = z.enum(["DRAFT", "ACTIVE", "FINISHED", "CANCELLED"], { error: "El estado del contrato no es válido." });
const currencySchema = z.enum(["ARS", "USD"], { error: "La moneda no es válida." });
const adjustmentIndexTypeSchema = z.enum(["IPC", "ICL", "UVA", "FIXED", "CUSTOM"], { error: "El índice de ajuste no es válido." });
const contractStructureStatusSchema = z.enum(["DRAFT", "PENDING_SIGNATURE", "ACTIVE", "FINALIZED", "FINISHED", "CANCELLED"], { error: "El estado del contrato no es válido." });
const finalizationReasonSchema = z.enum(["MUTUAL_AGREEMENT", "TENANT_BREACH", "OWNER_DECISION", "OTHER"], { error: "El motivo de finalización no es válido." });
const guaranteeTypeSchema = z.enum(["SALARY_RECEIPT", "PROPERTY_BACKED", "SURETY"], { error: "El tipo de garantía no es válido." });
const guaranteeStateSchema = z.enum(["ACTIVE", "RELEASED", "EXPIRED"], { error: "El estado de la garantía no es válido." });

const requiredId = (label: string) =>
  z
    .string({ error: requiredMessage(`${label} es obligatorio.`, `${label} debe ser texto.`) })
    .trim()
    .min(1, `${label} es obligatorio.`);

const isoDateString = (label: string) =>
  z
    .string({ error: requiredMessage(`${label} es obligatoria.`, `${label} debe ser texto.`) })
    .trim()
    .min(1, `${label} es obligatoria.`)
    .refine((value) => !Number.isNaN(Date.parse(value)), `${label} debe ser una fecha ISO válida.`);

const optionalIsoDateString = (label: string) => isoDateString(label).optional();

const rentAmountSchema = z
  .union([
    z
      .string({ error: "El monto del alquiler debe ser texto o número." })
      .trim()
      .regex(/^\d+(\.\d{1,2})?$/, "El monto del alquiler debe tener hasta dos decimales."),
    z.number({ error: "El monto del alquiler debe ser texto o número." }).finite("El monto del alquiler debe ser finito.")
  ])
  .transform((value) => (typeof value === "number" ? value.toString() : value))
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), "El monto del alquiler debe tener hasta dos decimales.")
  .refine((value) => Number(value) > 0, "El monto del alquiler debe ser mayor a cero.");

const contractFieldsSchema = z.object(
  {
    propertyId: requiredId("La propiedad"),
    ownerId: requiredId("El propietario"),
    renterId: requiredId("El inquilino"),
    status: rentalContractStatusSchema.optional(),
    startsAt: isoDateString("La fecha de inicio"),
    endsAt: isoDateString("La fecha de finalización"),
    rentAmount: rentAmountSchema,
    currency: currencySchema,
    dueDayOfMonth: z
      .number({ error: requiredMessage("El día de vencimiento es obligatorio.", "El día de vencimiento debe ser un número.") })
      .int("El día de vencimiento debe ser un número entero.")
      .min(1, "El día de vencimiento debe estar entre 1 y 31.")
      .max(31, "El día de vencimiento debe estar entre 1 y 31."),
    adjustmentIndexType: adjustmentIndexTypeSchema,
    adjustmentPeriodMonths: z
      .number({ error: requiredMessage("El período de ajuste es obligatorio.", "El período de ajuste debe ser un número.") })
      .int("El período de ajuste debe ser un número entero.")
      .positive("El período de ajuste debe ser positivo."),
    nextAdjustmentAt: optionalIsoDateString("La próxima fecha de ajuste")
  },
  { error: requiredMessage("Los datos del contrato son obligatorios.", "Los datos del contrato no son válidos.") }
);

export const createContractSchema = contractFieldsSchema
  .refine((data) => Date.parse(data.startsAt) < Date.parse(data.endsAt), {
    message: "La fecha de inicio debe ser anterior a la fecha de finalización.",
    path: ["endsAt"]
  });

export const updateContractSchema = contractFieldsSchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: "Tenés que enviar al menos un dato para actualizar."
});

export const changeContractStatusSchema = z.object(
  {
    status: rentalContractStatusSchema
  },
  { error: requiredMessage("El estado del contrato es obligatorio.", "El estado del contrato no es válido.") }
);

const contractPropertyInputSchema = z.object({
  propertyId: requiredId("La propiedad"),
  monthlyAmount: rentAmountSchema.optional()
});

export const createContractStructureSchema = z.object(
  {
    participantPersonaIds: z.array(requiredId("La persona participante"), { error: "Los participantes deben ser una lista." }).min(1, "Tenés que indicar al menos una persona participante."),
    properties: z.array(contractPropertyInputSchema, { error: "Las propiedades deben ser una lista." }).min(1, "Tenés que indicar al menos una propiedad."),
    status: contractStructureStatusSchema.optional(),
    startsAt: isoDateString("La fecha de inicio"),
    endsAt: isoDateString("La fecha de finalización"),
    monthlyTotalAmount: rentAmountSchema,
    currency: currencySchema,
    dueDayOfMonth: z.number({ error: requiredMessage("El día de vencimiento es obligatorio.", "El día de vencimiento debe ser un número.") }).int("El día de vencimiento debe ser un número entero.").min(1, "El día de vencimiento debe estar entre 1 y 31.").max(31, "El día de vencimiento debe estar entre 1 y 31."),
    adjustmentIndexType: adjustmentIndexTypeSchema,
    adjustmentPeriodMonths: z.number({ error: requiredMessage("El período de ajuste es obligatorio.", "El período de ajuste debe ser un número.") }).int("El período de ajuste debe ser un número entero.").positive("El período de ajuste debe ser positivo."),
    nextAdjustmentAt: optionalIsoDateString("La próxima fecha de ajuste"),
    commissionBps: z.number({ error: "La comisión del contrato debe ser un número." }).int("La comisión del contrato debe ser un número entero.").min(0, "La comisión del contrato no puede ser negativa.").max(10000, "La comisión del contrato no puede superar el 100%."),
    previousContractId: requiredId("El contrato anterior").optional()
  },
  { error: requiredMessage("Los datos de la estructura del contrato son obligatorios.", "Los datos de la estructura del contrato no son válidos.") }
).refine((data) => Date.parse(data.startsAt) < Date.parse(data.endsAt), {
  message: "La fecha de inicio debe ser anterior a la fecha de finalización.",
  path: ["endsAt"]
});

export const activateContractScheduleSchema = z.object({
  activatedAt: isoDateString("La fecha de activación"),
  estimatedAmount: rentAmountSchema.optional(),
  estimatedIndexValue: z.string({ error: "El índice estimado debe ser texto." }).trim().min(1, "El índice estimado es obligatorio.").optional(),
  estimatedIndexSource: z.string({ error: "La fuente del índice estimado debe ser texto." }).trim().min(1, "La fuente del índice estimado es obligatoria.").optional()
});

const salaryReceiptGuaranteeSchema = z.object({
  employerName: requiredId("El empleador"),
  employeeName: requiredId("La persona empleada"),
  employeeTaxId: requiredId("El CUIT/CUIL de la persona empleada").optional(),
  monthlyIncome: rentAmountSchema.optional(),
  employmentDate: optionalIsoDateString("La fecha de ingreso laboral")
});

const propertyBackedGuaranteeSchema = z.object({
  cadastralNomenclature: requiredId("La nomenclatura catastral"),
  registrationNumber: requiredId("La matrícula"),
  registrationLocality: requiredId("La localidad registral"),
  propertyAddress: requiredId("El domicilio de la garantía"),
  propertyCity: requiredId("La ciudad de la garantía").optional(),
  propertyProvince: requiredId("La provincia de la garantía").optional(),
  titleHolders: z.array(z.object({
    fullName: requiredId("El nombre del titular registral"),
    taxId: requiredId("El CUIT/CUIL del titular registral").optional(),
    signsGuarantee: z.boolean({ error: "Tenés que indicar si el titular firma la garantía." })
  }), { error: "Los titulares registrales deben ser una lista." }).min(1, "La garantía propietaria debe tener al menos un titular registral.")
});

const suretyGuaranteeSchema = z.object({
  companyName: requiredId("La compañía de caución"),
  policyNumber: requiredId("La póliza"),
  contactName: requiredId("El contacto de caución").optional(),
  contactEmail: requiredId("El email de caución").optional(),
  contactPhone: requiredId("El teléfono de caución").optional(),
  coverageAmount: rentAmountSchema.optional()
});

export const registerContractGuaranteeSchema = z.object({
  type: guaranteeTypeSchema,
  state: guaranteeStateSchema.optional(),
  startsAt: optionalIsoDateString("La fecha de inicio de la garantía"),
  endsAt: optionalIsoDateString("La fecha de fin de la garantía"),
  notes: z.string({ error: "Las notas deben ser texto." }).trim().max(500, "Las notas no pueden superar los 500 caracteres.").optional(),
  salaryReceipt: salaryReceiptGuaranteeSchema.optional(),
  propertyBacked: propertyBackedGuaranteeSchema.optional(),
  surety: suretyGuaranteeSchema.optional()
});

export const defineContractDepositSchema = z.object({
  amount: rentAmountSchema,
  currency: currencySchema,
  receivedAt: optionalIsoDateString("La fecha de recepción del depósito"),
  notes: z.string({ error: "Las notas deben ser texto." }).trim().max(500, "Las notas no pueden superar los 500 caracteres.").optional()
});

export const finalizeContractEarlySchema = z.object({
  finalizedAt: isoDateString("La fecha de finalización"),
  finalizationReason: finalizationReasonSchema,
  finalizationDescription: z.string({ error: "La descripción debe ser texto." }).trim().min(1, "La descripción es obligatoria.").optional()
});

export type CreateContractDto = z.infer<typeof createContractSchema>;
export type UpdateContractDto = z.infer<typeof updateContractSchema>;
export type ChangeContractStatusDto = z.infer<typeof changeContractStatusSchema>;
export type CreateContractStructureRequestDto = z.infer<typeof createContractStructureSchema>;
export type ActivateContractScheduleRequestDto = z.infer<typeof activateContractScheduleSchema>;
export type RegisterContractGuaranteeRequestDto = z.infer<typeof registerContractGuaranteeSchema>;
export type DefineContractDepositRequestDto = z.infer<typeof defineContractDepositSchema>;
export type FinalizeContractEarlyRequestDto = z.infer<typeof finalizeContractEarlySchema>;

export class CreateContractRequest {
  propertyId!: string;
  ownerId!: string;
  renterId!: string;
  status?: z.infer<typeof rentalContractStatusSchema>;
  startsAt!: string;
  endsAt!: string;
  rentAmount!: string | number;
  currency!: z.infer<typeof currencySchema>;
  dueDayOfMonth!: number;
  adjustmentIndexType!: z.infer<typeof adjustmentIndexTypeSchema>;
  adjustmentPeriodMonths!: number;
  nextAdjustmentAt?: string;
}

export class UpdateContractRequest {
  propertyId?: string;
  ownerId?: string;
  renterId?: string;
  status?: z.infer<typeof rentalContractStatusSchema>;
  startsAt?: string;
  endsAt?: string;
  rentAmount?: string | number;
  currency?: z.infer<typeof currencySchema>;
  dueDayOfMonth?: number;
  adjustmentIndexType?: z.infer<typeof adjustmentIndexTypeSchema>;
  adjustmentPeriodMonths?: number;
  nextAdjustmentAt?: string;
}

export class ChangeContractStatusRequest {
  status!: z.infer<typeof rentalContractStatusSchema>;
}
