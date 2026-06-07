import { z } from "zod";

const requiredMessage = (required: string, invalidType: string) => (issue: { input: unknown }) =>
  issue.input === undefined ? required : invalidType;

const optionalText = (message: string) => z.string({ error: message }).trim().min(1, message).optional();

export const personaKindSchema = z.enum(["FISICA", "JURIDICA"], { error: "El tipo de persona no es válido." });

export const personaFisicaSchema = z
  .object({
    firstName: optionalText("El nombre no puede estar vacío."),
    lastName: optionalText("El apellido no puede estar vacío."),
    dni: optionalText("El DNI no puede estar vacío."),
    cuit: optionalText("El CUIT no puede estar vacío."),
    dateOfBirth: z.coerce.date({ error: "La fecha de nacimiento debe ser válida." }).optional()
  })
  .strict()
  .refine((data) => data.dni !== undefined || data.cuit !== undefined, {
    message: "Una persona física debe incluir DNI y/o CUIT.",
    path: ["dni"]
  });

export const personaJuridicaSchema = z
  .object({
    legalName: z
      .string({ error: requiredMessage("La razón social es obligatoria.", "La razón social debe ser texto.") })
      .trim()
      .min(1, "La razón social es obligatoria."),
    cuit: z
      .string({ error: requiredMessage("Una persona jurídica debe incluir CUIT.", "El CUIT debe ser texto.") })
      .trim()
      .min(1, "Una persona jurídica debe incluir CUIT.")
  })
  .strict();

export const createPersonaSchema = z
  .object(
    {
      displayName: z
        .string({ error: requiredMessage("El nombre visible es obligatorio.", "El nombre visible debe ser texto.") })
        .trim()
        .min(1, "El nombre visible es obligatorio."),
      kind: personaKindSchema,
      email: z.string({ error: "El email debe ser texto." }).trim().email("El email no es válido.").optional(),
      phone: optionalText("El teléfono no puede estar vacío."),
      fisica: personaFisicaSchema.optional(),
      juridica: personaJuridicaSchema.optional()
    },
    { error: requiredMessage("Los datos de la persona son obligatorios.", "Los datos de la persona no son válidos.") }
  )
  .strict()
  .superRefine((data, ctx) => {
    if (data.kind === "FISICA" && data.fisica === undefined) {
      ctx.addIssue({ code: "custom", path: ["fisica"], message: "Tenés que enviar los datos de persona física." });
    }

    if (data.kind === "FISICA" && data.juridica !== undefined) {
      ctx.addIssue({ code: "custom", path: ["juridica"], message: "Una persona física no puede incluir datos de persona jurídica." });
    }

    if (data.kind === "JURIDICA" && data.juridica === undefined) {
      ctx.addIssue({ code: "custom", path: ["juridica"], message: "Tenés que enviar los datos de persona jurídica." });
    }

    if (data.kind === "JURIDICA" && data.fisica !== undefined) {
      ctx.addIssue({ code: "custom", path: ["fisica"], message: "Una persona jurídica no puede incluir datos de persona física." });
    }
  });

export type PersonaKindDto = z.infer<typeof personaKindSchema>;
export type CreatePersonaDto = z.infer<typeof createPersonaSchema>;
export type PersonaFisicaDto = z.infer<typeof personaFisicaSchema>;
export type PersonaJuridicaDto = z.infer<typeof personaJuridicaSchema>;

export class CreatePersonaRequest {
  displayName!: string;
  kind!: PersonaKindDto;
  email?: string;
  phone?: string;
  fisica?: PersonaFisicaDto;
  juridica?: PersonaJuridicaDto;
}
