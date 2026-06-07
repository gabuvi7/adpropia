import { z } from "zod";

const requiredMessage = (required: string, invalidType: string) => (issue: { input: unknown }) =>
  issue.input === undefined ? required : invalidType;

const optionalText = (message: string) => z.string({ error: message }).trim().min(1, message).optional();

export const personaKindSchema = z.enum(["FISICA", "JURIDICA"]);

export const personaFisicaSchema = z
  .object({
    firstName: optionalText("First name cannot be empty."),
    lastName: optionalText("Last name cannot be empty."),
    dni: optionalText("DNI cannot be empty."),
    cuit: optionalText("CUIT cannot be empty."),
    dateOfBirth: z.coerce.date({ error: "Date of birth must be a valid date." }).optional()
  })
  .strict()
  .refine((data) => data.dni !== undefined || data.cuit !== undefined, {
    message: "A natural person must include DNI and/or CUIT.",
    path: ["dni"]
  });

export const personaJuridicaSchema = z
  .object({
    legalName: z
      .string({ error: requiredMessage("Legal name is required.", "Legal name must be text.") })
      .trim()
      .min(1, "Legal name is required."),
    cuit: z
      .string({ error: requiredMessage("A legal person must include CUIT.", "CUIT must be text.") })
      .trim()
      .min(1, "A legal person must include CUIT.")
  })
  .strict();

export const createPersonaSchema = z
  .object(
    {
      displayName: z
        .string({ error: requiredMessage("Display name is required.", "Display name must be text.") })
        .trim()
        .min(1, "Display name is required."),
      kind: personaKindSchema,
      email: z.string({ error: "Email must be text." }).trim().email("Email is invalid.").optional(),
      phone: optionalText("Phone cannot be empty."),
      fisica: personaFisicaSchema.optional(),
      juridica: personaJuridicaSchema.optional()
    },
    { error: requiredMessage("Persona data is required.", "Persona data is invalid.") }
  )
  .strict()
  .superRefine((data, ctx) => {
    if (data.kind === "FISICA" && data.fisica === undefined) {
      ctx.addIssue({ code: "custom", path: ["fisica"], message: "Natural person details are required." });
    }

    if (data.kind === "FISICA" && data.juridica !== undefined) {
      ctx.addIssue({ code: "custom", path: ["juridica"], message: "A natural person cannot include legal person details." });
    }

    if (data.kind === "JURIDICA" && data.juridica === undefined) {
      ctx.addIssue({ code: "custom", path: ["juridica"], message: "Legal person details are required." });
    }

    if (data.kind === "JURIDICA" && data.fisica !== undefined) {
      ctx.addIssue({ code: "custom", path: ["fisica"], message: "A legal person cannot include natural person details." });
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
