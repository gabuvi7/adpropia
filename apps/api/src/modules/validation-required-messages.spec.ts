import { describe, expect, it } from "vitest";
import { linkTenantAuth0OrgSchema } from "./admin/admin-provisioning.dto";
import { createContractSchema } from "./contracts/contracts.dto";
import { createLiquidationSchema } from "./liquidations/liquidations.dto";
import { createOwnerSchema } from "./owners/owners.dto";
import { balanceQuerySchema } from "./payments/payments.dto";
import { createPropertySchema } from "./properties/properties.dto";
import { cashFlowQuerySchema } from "./reports/reports.dto";
import { createTenantSchema } from "./tenants/tenants.dto";

const firstMessage = (schema: { safeParse: (input: unknown) => { success: boolean; error?: { issues: Array<{ message: string }> } } }, input: unknown) => {
  const result = schema.safeParse(input);

  expect(result.success).toBe(false);
  return result.error?.issues[0]?.message;
};

describe("Zod validation required messages", () => {
  it("keeps required and invalid-type messages distinct for required scalar fields", () => {
    expect(firstMessage(createOwnerSchema, {})).toBe("El nombre visible es obligatorio.");
    expect(firstMessage(createOwnerSchema, { displayName: 42 })).toBe("El nombre visible debe ser texto.");

    expect(firstMessage(createPropertySchema, { type: "HOUSE", addressLine: "Main 1" })).toBe("El propietario es obligatorio.");
    expect(firstMessage(createPropertySchema, { ownerId: 42, type: "HOUSE", addressLine: "Main 1" })).toBe("El propietario debe ser texto.");

    expect(firstMessage(createContractSchema, { ownerId: "owner-1", renterId: "renter-1" })).toBe("La propiedad es obligatorio.");
    expect(firstMessage(createContractSchema, { propertyId: 42, ownerId: "owner-1", renterId: "renter-1" })).toBe("La propiedad debe ser texto.");

    expect(firstMessage(createContractSchema, { propertyId: "property-1", ownerId: "owner-1", renterId: "renter-1", startsAt: "2026-01-01", endsAt: "2026-12-31", rentAmount: "1000", currency: "ARS", dueDayOfMonth: 10, adjustmentIndexType: "IPC" })).toBe(
      "El período de ajuste es obligatorio."
    );
    expect(firstMessage(createContractSchema, { propertyId: "property-1", ownerId: "owner-1", renterId: "renter-1", startsAt: "2026-01-01", endsAt: "2026-12-31", rentAmount: "1000", currency: "ARS", dueDayOfMonth: 10, adjustmentIndexType: "IPC", adjustmentPeriodMonths: "1" })).toBe(
      "El período de ajuste debe ser un número."
    );
  });

  it("keeps required and invalid-type messages distinct for required object bodies", () => {
    expect(firstMessage(createOwnerSchema, undefined)).toBe("Los datos del propietario son obligatorios.");
    expect(firstMessage(createOwnerSchema, 42)).toBe("Los datos del propietario no son válidos.");

    expect(firstMessage(createTenantSchema, undefined)).toBe("Los datos de la inmobiliaria son obligatorios.");
    expect(firstMessage(createTenantSchema, 42)).toBe("Los datos de la inmobiliaria no son válidos.");

    expect(firstMessage(createTenantSchema, { name: "Acme", slug: "acme" })).toBe("La configuración de la inmobiliaria es obligatoria.");
    expect(firstMessage(createTenantSchema, { name: "Acme", slug: "acme", settings: 42 })).toBe("La configuración enviada no es válida.");

    expect(firstMessage(createLiquidationSchema, undefined)).toBe("Las fechas del período son obligatorias y deben tener formato ISO.");
    expect(firstMessage(createLiquidationSchema, 42)).toBe("Los datos de la liquidación no son válidos.");

    expect(firstMessage(balanceQuerySchema, undefined)).toBe("El contrato es obligatorio.");
    expect(firstMessage(balanceQuerySchema, 42)).toBe("El contrato no es válido.");
  });

  it("keeps required messages in admin and report schemas", () => {
    expect(firstMessage(linkTenantAuth0OrgSchema, {})).toBe("El ID de organización de Auth0 es obligatorio.");
    expect(firstMessage(linkTenantAuth0OrgSchema, { auth0OrgId: 42 })).toBe("El ID de organización de Auth0 debe ser texto.");

    expect(firstMessage(cashFlowQuerySchema, {})).toBe("El mes es obligatorio.");
    expect(firstMessage(cashFlowQuerySchema, { month: 42 })).toBe("El mes debe ser texto.");
  });
});
