import { z } from "zod";

const requiredMessage = (required: string, invalidType: string) => (issue: { input: unknown }) =>
  issue.input === undefined ? required : invalidType;
const optionalText = (message: string) => z.string({ error: message }).trim().min(1, message).optional();
const propertyTypeSchema = z.enum(["APARTMENT", "HOUSE", "COMMERCIAL", "LAND", "OTHER"], { error: "El tipo de propiedad no es válido." });
const propertyStatusSchema = z.enum(["AVAILABLE", "RENTED", "INACTIVE"], { error: "El estado de la propiedad no es válido." });
const requiredId = (label: string) =>
  z
    .string({ error: requiredMessage(`${label} es obligatorio.`, `${label} debe ser texto.`) })
    .trim()
    .min(1, `${label} es obligatorio.`);
const ownershipShareBpsSchema = z
  .number({ error: "El porcentaje de titularidad debe ser un número." })
  .int("El porcentaje de titularidad debe ser un número entero.")
  .min(1, "El porcentaje de titularidad debe ser mayor a cero.")
  .max(10000, "El porcentaje de titularidad no puede superar el 100%.");

export const createPropertySchema = z.object(
  {
    ownerId: z
      .string({ error: requiredMessage("El propietario es obligatorio.", "El propietario debe ser texto.") })
      .trim()
      .min(1, "El propietario es obligatorio."),
    type: propertyTypeSchema,
    status: propertyStatusSchema.optional(),
    addressLine: z
      .string({ error: requiredMessage("La dirección es obligatoria.", "La dirección debe ser texto.") })
      .trim()
      .min(1, "La dirección es obligatoria."),
    city: optionalText("La ciudad no puede estar vacía."),
    province: optionalText("La provincia no puede estar vacía."),
    postalCode: optionalText("El código postal no puede estar vacío."),
    commissionBps: z
      .number({ error: "La comisión debe ser un número." })
      .int("La comisión debe ser un número entero.")
      .min(0, "La comisión no puede ser negativa.")
      .optional()
  },
  { error: requiredMessage("Los datos de la propiedad son obligatorios.", "Los datos de la propiedad no son válidos.") }
);

export const updatePropertySchema = createPropertySchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: "Tenés que enviar al menos un dato para actualizar."
});

const propertyOwnerParticipationSchema = z.object({
  personaId: requiredId("La persona propietaria"),
  ownershipShareBps: ownershipShareBpsSchema
});

const propertyServiceLinkSchema = z.object({
  serviceTypeId: requiredId("El servicio"),
  accountNumber: optionalText("El número de cuenta no puede estar vacío.")
});

export const createPropertyUnitSchema = z.object(
  {
    propertyTypeId: requiredId("El tipo de propiedad"),
    addressLine: z
      .string({ error: requiredMessage("La dirección es obligatoria.", "La dirección debe ser texto.") })
      .trim()
      .min(1, "La dirección es obligatoria."),
    status: propertyStatusSchema.optional(),
    buildingName: optionalText("El nombre del edificio no puede estar vacío."),
    city: optionalText("La ciudad no puede estar vacía."),
    province: optionalText("La provincia no puede estar vacía."),
    postalCode: optionalText("El código postal no puede estar vacío."),
    commissionBps: z.number({ error: "La comisión debe ser un número." }).int("La comisión debe ser un número entero.").min(0, "La comisión no puede ser negativa.").optional(),
    owners: z.array(propertyOwnerParticipationSchema, { error: "Los propietarios deben ser una lista." }).min(1, "Tenés que indicar al menos una persona propietaria."),
    services: z.array(propertyServiceLinkSchema, { error: "Los servicios deben ser una lista." }).optional()
  },
  { error: requiredMessage("Los datos de la unidad funcional son obligatorios.", "Los datos de la unidad funcional no son válidos.") }
);

export const updatePropertyOwnershipSchema = z.object(
  {
    owners: z.array(propertyOwnerParticipationSchema, { error: "Los propietarios deben ser una lista." }).min(1, "Tenés que indicar al menos una persona propietaria.")
  },
  { error: requiredMessage("Los datos de titularidad son obligatorios.", "Los datos de titularidad no son válidos.") }
);

export type CreatePropertyDto = z.infer<typeof createPropertySchema>;
export type UpdatePropertyDto = z.infer<typeof updatePropertySchema>;
export type CreatePropertyUnitRequestDto = z.infer<typeof createPropertyUnitSchema>;
export type UpdatePropertyOwnershipRequestDto = z.infer<typeof updatePropertyOwnershipSchema>;

export class CreatePropertyRequest {
  ownerId!: string;
  type!: z.infer<typeof propertyTypeSchema>;
  status?: z.infer<typeof propertyStatusSchema>;
  addressLine!: string;
  city?: string;
  province?: string;
  postalCode?: string;
  commissionBps?: number;
}

export class UpdatePropertyRequest {
  ownerId?: string;
  type?: z.infer<typeof propertyTypeSchema>;
  status?: z.infer<typeof propertyStatusSchema>;
  addressLine?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  commissionBps?: number;
}
