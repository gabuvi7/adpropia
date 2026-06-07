import { z } from "zod";

const requiredMessage = (required: string, invalidType: string) => (issue: { input: unknown }) =>
  issue.input === undefined ? required : invalidType;

const requiredText = (field: string) =>
  z
    .string({ error: requiredMessage(`El campo ${field} es obligatorio.`, `El campo ${field} debe ser texto.`) })
    .trim()
    .min(1, `El campo ${field} es obligatorio.`);

const optionalText = (message: string) => z.string({ error: message }).trim().min(1, message).optional();
const optionalRecord = (message: string) => z.record(z.string(), z.unknown(), { error: message }).optional();

export const tenantSettingsSchema = z.object(
  {
    commercialName: requiredText("nombre comercial"),
    logoUrl: z.string({ error: "La URL del logo debe ser texto." }).trim().url("La URL del logo no es válida.").optional(),
    primaryColor: optionalText("El color principal no puede estar vacío."),
    defaultCurrency: z.enum(["ARS", "USD"], { error: "La moneda predeterminada no es válida." }).default("ARS"),
    defaultCommissionBps: z
      .number({ error: "La comisión debe ser un número." })
      .int("La comisión debe ser un número entero.")
      .min(0, "La comisión no puede ser negativa.")
      .default(0),
    operationalParameters: optionalRecord("Los parámetros operativos no son válidos.")
  },
  { error: requiredMessage("La configuración de la inmobiliaria es obligatoria.", "La configuración enviada no es válida.") }
);

export const createTenantSchema = z.object(
  {
    name: requiredText("nombre"),
    slug: requiredText("slug").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "El slug solo puede usar minúsculas, números y guiones."),
    customDomain: optionalText("El dominio personalizado no puede estar vacío."),
    settings: tenantSettingsSchema
  },
  { error: requiredMessage("Los datos de la inmobiliaria son obligatorios.", "Los datos de la inmobiliaria no son válidos.") }
);

export type CreateTenantDto = z.infer<typeof createTenantSchema>;

export class CreateTenantRequest {
  name!: string;
  slug!: string;
  customDomain?: string;
  settings!: z.infer<typeof tenantSettingsSchema>;
}
