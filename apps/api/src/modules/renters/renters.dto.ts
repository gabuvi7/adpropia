import { z } from "zod";

const requiredMessage = (required: string, invalidType: string) => (issue: { input: unknown }) =>
  issue.input === undefined ? required : invalidType;
const optionalText = (message: string) => z.string({ error: message }).trim().min(1, message).optional();
const optionalRecord = (message: string) => z.record(z.string(), z.unknown(), { error: message }).optional();

export const createRenterSchema = z.object(
  {
    displayName: z
      .string({ error: requiredMessage("El nombre visible es obligatorio.", "El nombre visible debe ser texto.") })
      .trim()
      .min(1, "El nombre visible es obligatorio."),
    email: z.string({ error: "El email debe ser texto." }).trim().email("El email no es válido.").optional(),
    phone: optionalText("El teléfono no puede estar vacío."),
    identityNumber: optionalText("El documento no puede estar vacío."),
    guaranteeInfo: optionalRecord("La información de garantía no es válida.")
  },
  { error: requiredMessage("Los datos del inquilino son obligatorios.", "Los datos del inquilino no son válidos.") }
);

export const updateRenterSchema = createRenterSchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: "Tenés que enviar al menos un dato para actualizar."
});

export type CreateRenterDto = z.infer<typeof createRenterSchema>;
export type UpdateRenterDto = z.infer<typeof updateRenterSchema>;

export class CreateRenterRequest {
  displayName!: string;
  email?: string;
  phone?: string;
  identityNumber?: string;
  guaranteeInfo?: Record<string, unknown>;
}

export class UpdateRenterRequest {
  displayName?: string;
  email?: string;
  phone?: string;
  identityNumber?: string;
  guaranteeInfo?: Record<string, unknown>;
}
