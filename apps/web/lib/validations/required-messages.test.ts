import { describe, expect, it } from "vitest";
import { contractSchema } from "./contracts.schema";
import { ownerSchema } from "./owners.schema";
import { propertySchema } from "./properties.schema";

const firstMessage = (schema: { safeParse: (input: unknown) => { success: boolean; error?: { issues: Array<{ message: string }> } } }, input: unknown) => {
  const result = schema.safeParse(input);

  expect(result.success).toBe(false);
  return result.error?.issues[0]?.message;
};

describe("web validation required messages", () => {
  it("keeps existing required-field messages for missing values", () => {
    expect(firstMessage(ownerSchema, {})).toBe("El nombre del propietario es obligatorio");
    expect(firstMessage(propertySchema, { type: "HOUSE" })).toBe("Seleccioná un propietario");
    expect(firstMessage(contractSchema, { ownerId: "owner-1", renterId: "renter-1" })).toBe("Seleccioná una propiedad");
  });
});
