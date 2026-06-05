import { z } from "zod";

const requiredMessage = (required: string, invalidType: string) => (issue: { input: unknown }) =>
  issue.input === undefined ? required : invalidType;

const rentalContractStatusSchema = z.enum(["DRAFT", "ACTIVE", "FINISHED", "CANCELLED"], { error: "El estado del contrato no es válido." });
const currencySchema = z.enum(["ARS", "USD"], { error: "La moneda no es válida." });
const adjustmentIndexTypeSchema = z.enum(["IPC", "ICL", "UVA", "FIXED", "CUSTOM"], { error: "El índice de ajuste no es válido." });

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

export type CreateContractDto = z.infer<typeof createContractSchema>;
export type UpdateContractDto = z.infer<typeof updateContractSchema>;
export type ChangeContractStatusDto = z.infer<typeof changeContractStatusSchema>;

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
