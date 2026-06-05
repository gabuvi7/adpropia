import { propertyStatuses, propertyTypes } from "@adpropia/shared";
import { z } from "zod";

export const propertySchema = z.object({
  ownerId: z.string({ error: "Seleccioná un propietario" }).min(1, "Seleccioná un propietario"),
  type: z.enum(propertyTypes, { error: "Seleccioná un tipo de propiedad válido" }),
  status: z.enum(propertyStatuses, { error: "Seleccioná un estado de propiedad válido" }).default("AVAILABLE"),
  addressLine: z.string({ error: "La dirección es obligatoria" }).min(1, "La dirección es obligatoria"),
  city: z.string().optional(),
  province: z.string().optional(),
  commissionBps: z
    .number({ error: "Ingresá una comisión válida" })
    .int("La comisión debe ser un número entero")
    .min(0, "La comisión no puede ser negativa")
    .max(10_000, "La comisión no puede superar el 100 %")
    .optional()
});

export type PropertyInput = z.infer<typeof propertySchema>;
