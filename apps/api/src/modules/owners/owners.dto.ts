import { z } from "zod";

const requiredMessage = (required: string, invalidType: string) => (issue: { input: unknown }) =>
  issue.input === undefined ? required : invalidType;
const optionalText = (message: string) => z.string({ error: message }).trim().min(1, message).optional();
const optionalRecord = (message: string) => z.record(z.string(), z.unknown(), { error: message }).optional();

export const createOwnerSchema = z.object(
  {
    displayName: z
      .string({ error: requiredMessage("El nombre visible es obligatorio.", "El nombre visible debe ser texto.") })
      .trim()
      .min(1, "El nombre visible es obligatorio."),
    email: z.string({ error: "El email debe ser texto." }).trim().email("El email no es válido.").optional(),
    phone: optionalText("El teléfono no puede estar vacío."),
    taxId: optionalText("La identificación fiscal no puede estar vacía."),
    paymentDetails: optionalRecord("Los datos de pago no son válidos.")
  },
  { error: requiredMessage("Los datos del propietario son obligatorios.", "Los datos del propietario no son válidos.") }
);

export const updateOwnerSchema = createOwnerSchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: "Tenés que enviar al menos un dato para actualizar."
});

export type CreateOwnerDto = z.infer<typeof createOwnerSchema>;
export type UpdateOwnerDto = z.infer<typeof updateOwnerSchema>;

export class CreateOwnerRequest {
  displayName!: string;
  email?: string;
  phone?: string;
  taxId?: string;
  paymentDetails?: Record<string, unknown>;
}

export class UpdateOwnerRequest {
  displayName?: string;
  email?: string;
  phone?: string;
  taxId?: string;
  paymentDetails?: Record<string, unknown>;
}
