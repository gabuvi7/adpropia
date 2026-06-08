import { z } from "zod";

const requiredMessage = (required: string, invalidType: string) => (issue: { input: unknown }) =>
  issue.input === undefined ? required : invalidType;

const indexProviderSourceSchema = z.enum(["ARQUILER", "MANUAL", "OFFICIAL", "ARGLY"], { error: "La fuente del índice no es válida." });
const economicIndexTypeSchema = z.enum(["IPC", "ICL", "UVA", "FIXED", "CUSTOM"], { error: "El tipo de índice económico no es válido." });

const isoDateAsDate = (label: string) =>
  z
    .string({ error: requiredMessage(`${label} es obligatoria.`, `${label} debe ser texto.`) })
    .trim()
    .min(1, `${label} es obligatoria.`)
    .refine((value) => !Number.isNaN(Date.parse(value)), `${label} debe ser una fecha ISO válida.`)
    .transform((value) => new Date(value));

export const persistPublishedIndexSchema = z.object(
  {
    source: indexProviderSourceSchema,
    type: economicIndexTypeSchema,
    periodDate: isoDateAsDate("La fecha del período"),
    value: z
      .string({ error: requiredMessage("El valor del índice es obligatorio.", "El valor del índice debe ser texto.") })
      .trim()
      .min(1, "El valor del índice es obligatorio."),
    publishedAt: isoDateAsDate("La fecha de publicación")
  },
  { error: requiredMessage("Los datos del índice son obligatorios.", "Los datos del índice no son válidos.") }
);

export type PersistPublishedIndexDto = z.infer<typeof persistPublishedIndexSchema>;
