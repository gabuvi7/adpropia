import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  createPropertySchema,
  createPropertyUnitSchema,
  updatePropertyOwnershipSchema,
  updatePropertySchema,
} from "./properties.dto";

type SchemaUnderTest = z.ZodType;

function messagesFor(
  schema: SchemaUnderTest,
  input: unknown,
  path?: PropertyKey[],
) {
  const result = schema.safeParse(input);

  expect(result.success).toBe(false);

  if (result.success) {
    return [];
  }

  const issues = result.error.issues;
  return path === undefined
    ? issues.map((issue) => issue.message)
    : issues
        .filter((issue) => issue.path.join(".") === path.join("."))
        .map((issue) => issue.message);
}

function expectMessageFor(
  schema: SchemaUnderTest,
  input: unknown,
  path: PropertyKey[],
  message: string,
) {
  expect(messagesFor(schema, input, path)).toContain(message);
}

describe("property DTO validation", () => {
  it("rejects missing, empty, and whitespace-only required fields", () => {
    expectMessageFor(
      createPropertySchema,
      { type: "HOUSE", addressLine: "Main 1" },
      ["ownerId"],
      "El propietario es obligatorio.",
    );
    expectMessageFor(
      createPropertySchema,
      { ownerId: "", type: "HOUSE", addressLine: "Main 1" },
      ["ownerId"],
      "El propietario es obligatorio.",
    );
    expectMessageFor(
      createPropertySchema,
      { ownerId: "   ", type: "HOUSE", addressLine: "Main 1" },
      ["ownerId"],
      "El propietario es obligatorio.",
    );
    expectMessageFor(
      createPropertySchema,
      { ownerId: "owner-1", type: "HOUSE" },
      ["addressLine"],
      "La dirección es obligatoria.",
    );
    expectMessageFor(
      createPropertySchema,
      { ownerId: "owner-1", type: "HOUSE", addressLine: "   " },
      ["addressLine"],
      "La dirección es obligatoria.",
    );

    expectMessageFor(
      createPropertyUnitSchema,
      {
        propertyTypeId: "   ",
        addressLine: "Main 1",
        owners: [{ personaId: "persona-1", ownershipShareBps: 10000 }],
      },
      ["propertyTypeId"],
      "El tipo de propiedad es obligatorio.",
    );
    expectMessageFor(
      createPropertyUnitSchema,
      {
        propertyTypeId: "type-1",
        owners: [{ personaId: "persona-1", ownershipShareBps: 10000 }],
      },
      ["addressLine"],
      "La dirección es obligatoria.",
    );
    expectMessageFor(
      createPropertyUnitSchema,
      {
        propertyTypeId: "type-1",
        addressLine: "   ",
        owners: [{ personaId: "persona-1", ownershipShareBps: 10000 }],
      },
      ["addressLine"],
      "La dirección es obligatoria.",
    );
    expectMessageFor(
      createPropertyUnitSchema,
      {
        propertyTypeId: "type-1",
        addressLine: "Main 1",
        owners: [{ personaId: "   ", ownershipShareBps: 10000 }],
      },
      ["owners", 0, "personaId"],
      "La persona propietaria es obligatorio.",
    );
  });

  it("reports Spanish messages for invalid types in required fields", () => {
    expectMessageFor(
      createPropertySchema,
      { ownerId: 42, type: "HOUSE", addressLine: "Main 1" },
      ["ownerId"],
      "El propietario debe ser texto.",
    );
    expectMessageFor(
      createPropertySchema,
      { ownerId: "owner-1", type: "HOUSE", addressLine: 42 },
      ["addressLine"],
      "La dirección debe ser texto.",
    );

    expectMessageFor(
      createPropertyUnitSchema,
      {
        propertyTypeId: 42,
        addressLine: "Main 1",
        owners: [{ personaId: "persona-1", ownershipShareBps: 10000 }],
      },
      ["propertyTypeId"],
      "El tipo de propiedad debe ser texto.",
    );
    expectMessageFor(
      createPropertyUnitSchema,
      {
        propertyTypeId: "type-1",
        addressLine: 42,
        owners: [{ personaId: "persona-1", ownershipShareBps: 10000 }],
      },
      ["addressLine"],
      "La dirección debe ser texto.",
    );
    expectMessageFor(
      createPropertyUnitSchema,
      {
        propertyTypeId: "type-1",
        addressLine: "Main 1",
        owners: [{ personaId: 42, ownershipShareBps: 10000 }],
      },
      ["owners", 0, "personaId"],
      "La persona propietaria debe ser texto.",
    );
  });

  it("rejects whitespace-only optional text fields when present", () => {
    expectMessageFor(
      createPropertySchema,
      { ownerId: "owner-1", type: "HOUSE", addressLine: "Main 1", city: "   " },
      ["city"],
      "La ciudad no puede estar vacía.",
    );
    expectMessageFor(
      createPropertySchema,
      {
        ownerId: "owner-1",
        type: "HOUSE",
        addressLine: "Main 1",
        province: "   ",
      },
      ["province"],
      "La provincia no puede estar vacía.",
    );
    expectMessageFor(
      createPropertySchema,
      {
        ownerId: "owner-1",
        type: "HOUSE",
        addressLine: "Main 1",
        postalCode: "   ",
      },
      ["postalCode"],
      "El código postal no puede estar vacío.",
    );
    expectMessageFor(
      createPropertyUnitSchema,
      {
        propertyTypeId: "type-1",
        addressLine: "Main 1",
        buildingName: "   ",
        owners: [{ personaId: "persona-1", ownershipShareBps: 10000 }],
      },
      ["buildingName"],
      "El nombre del edificio no puede estar vacío.",
    );
    expectMessageFor(
      createPropertyUnitSchema,
      {
        propertyTypeId: "type-1",
        addressLine: "Main 1",
        city: "   ",
        owners: [{ personaId: "persona-1", ownershipShareBps: 10000 }],
      },
      ["city"],
      "La ciudad no puede estar vacía.",
    );
    expectMessageFor(
      createPropertyUnitSchema,
      {
        propertyTypeId: "type-1",
        addressLine: "Main 1",
        province: "   ",
        owners: [{ personaId: "persona-1", ownershipShareBps: 10000 }],
      },
      ["province"],
      "La provincia no puede estar vacía.",
    );
    expectMessageFor(
      createPropertyUnitSchema,
      {
        propertyTypeId: "type-1",
        addressLine: "Main 1",
        postalCode: "   ",
        owners: [{ personaId: "persona-1", ownershipShareBps: 10000 }],
      },
      ["postalCode"],
      "El código postal no puede estar vacío.",
    );
  });

  it("reports Spanish messages for invalid property type and status values", () => {
    expectMessageFor(
      createPropertySchema,
      {
        ownerId: "owner-1",
        type: "GARAGE",
        status: "AVAILABLE",
        addressLine: "Main 1",
      },
      ["type"],
      "El tipo de propiedad no es válido.",
    );
    expectMessageFor(
      createPropertySchema,
      {
        ownerId: "owner-1",
        type: "HOUSE",
        status: "OCCUPIED",
        addressLine: "Main 1",
      },
      ["status"],
      "El estado de la propiedad no es válido.",
    );
    expectMessageFor(
      createPropertyUnitSchema,
      {
        propertyTypeId: "type-1",
        addressLine: "Main 1",
        status: "OCCUPIED",
        owners: [{ personaId: "persona-1", ownershipShareBps: 10000 }],
      },
      ["status"],
      "El estado de la propiedad no es válido.",
    );
  });

  it("validates ownership share basis points boundaries and numeric shape", () => {
    const baseUnit = { propertyTypeId: "type-1", addressLine: "Main 1" };

    expectMessageFor(
      createPropertyUnitSchema,
      {
        ...baseUnit,
        owners: [{ personaId: "persona-1", ownershipShareBps: 0 }],
      },
      ["owners", 0, "ownershipShareBps"],
      "El porcentaje de titularidad debe ser mayor a cero.",
    );
    expectMessageFor(
      createPropertyUnitSchema,
      {
        ...baseUnit,
        owners: [{ personaId: "persona-1", ownershipShareBps: -1 }],
      },
      ["owners", 0, "ownershipShareBps"],
      "El porcentaje de titularidad debe ser mayor a cero.",
    );
    expectMessageFor(
      createPropertyUnitSchema,
      {
        ...baseUnit,
        owners: [{ personaId: "persona-1", ownershipShareBps: 10001 }],
      },
      ["owners", 0, "ownershipShareBps"],
      "El porcentaje de titularidad no puede superar el 100%.",
    );
    expectMessageFor(
      createPropertyUnitSchema,
      {
        ...baseUnit,
        owners: [{ personaId: "persona-1", ownershipShareBps: 50.5 }],
      },
      ["owners", 0, "ownershipShareBps"],
      "El porcentaje de titularidad debe ser un número entero.",
    );
    expectMessageFor(
      createPropertyUnitSchema,
      {
        ...baseUnit,
        owners: [{ personaId: "persona-1", ownershipShareBps: "10000" }],
      },
      ["owners", 0, "ownershipShareBps"],
      "El porcentaje de titularidad debe ser un número.",
    );
  });

  it("validates optional commission basis points when present", () => {
    expectMessageFor(
      createPropertySchema,
      {
        ownerId: "owner-1",
        type: "HOUSE",
        addressLine: "Main 1",
        commissionBps: "100",
      },
      ["commissionBps"],
      "La comisión debe ser un número.",
    );
    expectMessageFor(
      createPropertySchema,
      {
        ownerId: "owner-1",
        type: "HOUSE",
        addressLine: "Main 1",
        commissionBps: 10.5,
      },
      ["commissionBps"],
      "La comisión debe ser un número entero.",
    );
    expectMessageFor(
      createPropertySchema,
      {
        ownerId: "owner-1",
        type: "HOUSE",
        addressLine: "Main 1",
        commissionBps: -1,
      },
      ["commissionBps"],
      "La comisión no puede ser negativa.",
    );

    const propertyResult = createPropertySchema.safeParse({
      ownerId: "owner-1",
      type: "HOUSE",
      addressLine: "Main 1",
      commissionBps: 1,
    });
    expect(propertyResult.success).toBe(true);

    expectMessageFor(
      createPropertyUnitSchema,
      {
        propertyTypeId: "type-1",
        addressLine: "Main 1",
        commissionBps: "100",
        owners: [{ personaId: "persona-1", ownershipShareBps: 10000 }],
      },
      ["commissionBps"],
      "La comisión debe ser un número.",
    );
    expectMessageFor(
      createPropertyUnitSchema,
      {
        propertyTypeId: "type-1",
        addressLine: "Main 1",
        commissionBps: 10.5,
        owners: [{ personaId: "persona-1", ownershipShareBps: 10000 }],
      },
      ["commissionBps"],
      "La comisión debe ser un número entero.",
    );
    expectMessageFor(
      createPropertyUnitSchema,
      {
        propertyTypeId: "type-1",
        addressLine: "Main 1",
        commissionBps: -1,
        owners: [{ personaId: "persona-1", ownershipShareBps: 10000 }],
      },
      ["commissionBps"],
      "La comisión no puede ser negativa.",
    );

    const unitResult = createPropertyUnitSchema.safeParse({
      propertyTypeId: "type-1",
      addressLine: "Main 1",
      commissionBps: 1,
      owners: [{ personaId: "persona-1", ownershipShareBps: 10000 }],
    });
    expect(unitResult.success).toBe(true);
  });

  it("rejects empty property updates", () => {
    expect(messagesFor(updatePropertySchema, {})).toContain(
      "Tenés que enviar al menos un dato para actualizar.",
    );

    const result = updatePropertySchema.safeParse({ addressLine: "Main 1" });
    expect(result.success).toBe(true);
  });

  it("requires at least one owner in creation and ownership update payloads", () => {
    expectMessageFor(
      createPropertyUnitSchema,
      { propertyTypeId: "type-1", addressLine: "Main 1", owners: [] },
      ["owners"],
      "Tenés que indicar al menos una persona propietaria.",
    );
    expectMessageFor(
      createPropertyUnitSchema,
      { propertyTypeId: "type-1", addressLine: "Main 1", owners: 42 },
      ["owners"],
      "Los propietarios deben ser una lista.",
    );
    expectMessageFor(
      updatePropertyOwnershipSchema,
      { owners: [] },
      ["owners"],
      "Tenés que indicar al menos una persona propietaria.",
    );
    expectMessageFor(
      updatePropertyOwnershipSchema,
      { owners: 42 },
      ["owners"],
      "Los propietarios deben ser una lista.",
    );
  });

  it("validates service links and trims accepted service account numbers", () => {
    const baseUnit = {
      propertyTypeId: "type-1",
      addressLine: "Main 1",
      owners: [{ personaId: "persona-1", ownershipShareBps: 10000 }],
    };

    expectMessageFor(
      createPropertyUnitSchema,
      { ...baseUnit, services: [{ serviceTypeId: "   " }] },
      ["services", 0, "serviceTypeId"],
      "El servicio es obligatorio.",
    );
    expectMessageFor(
      createPropertyUnitSchema,
      { ...baseUnit, services: 42 },
      ["services"],
      "Los servicios deben ser una lista.",
    );
    expectMessageFor(
      createPropertyUnitSchema,
      {
        ...baseUnit,
        services: [{ serviceTypeId: "service-1", accountNumber: "   " }],
      },
      ["services", 0, "accountNumber"],
      "El número de cuenta no puede estar vacío.",
    );

    const result = createPropertyUnitSchema.safeParse({
      ...baseUnit,
      services: [{ serviceTypeId: "service-1", accountNumber: "  AC-123  " }],
    });

    expect(result.success).toBe(true);
    expect(result.data?.services?.[0]?.accountNumber).toBe("AC-123");
  });
});
