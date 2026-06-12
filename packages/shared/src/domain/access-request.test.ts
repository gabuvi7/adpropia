import { describe, expect, it } from "vitest";
import {
  accessPlanLabels,
  accessRequestModules,
  accessRequestSchema,
  recommendAccessPlan
} from "./access-request";

describe("access request domain", () => {
  it("recommends Inicial when rental/administration units and users fit the first threshold", () => {
    const recommendation = recommendAccessPlan({
      rentalAdministrationUnits: 50,
      saleUnits: 10,
      users: 2
    });

    expect(recommendation.plan).toBe("INICIAL");
    expect(accessPlanLabels[recommendation.plan]).toBe("Inicial");
  });

  it("recommends Profesional and Operativo at their published thresholds", () => {
    expect(recommendAccessPlan({ rentalAdministrationUnits: 200, saleUnits: 0, users: 5 }).plan).toBe("PROFESIONAL");
    expect(recommendAccessPlan({ rentalAdministrationUnits: 500, saleUnits: 0, users: 10 }).plan).toBe("OPERATIVO");
  });

  it("recommends A medida when units or users exceed Operativo", () => {
    expect(recommendAccessPlan({ rentalAdministrationUnits: 501, saleUnits: 0, users: 10 }).plan).toBe("A_MEDIDA");
    expect(recommendAccessPlan({ rentalAdministrationUnits: 500, saleUnits: 0, users: 11 }).plan).toBe("A_MEDIDA");
  });

  it("keeps sale units outside the base plan recommendation", () => {
    const withoutSales = recommendAccessPlan({ rentalAdministrationUnits: 45, saleUnits: 0, users: 2 });
    const withManySales = recommendAccessPlan({ rentalAdministrationUnits: 45, saleUnits: 900, users: 2 });

    expect(withManySales.plan).toBe(withoutSales.plan);
    expect(withManySales.saleUnitsCapturedSeparately).toBe(900);
  });

  it("exposes the required module label for sale-unit management", () => {
    expect(accessRequestModules).toContainEqual({
      value: "SALE_UNIT_MANAGEMENT",
      label: "Gestión de unidades en venta"
    });
    expect(accessRequestModules.map((module) => module.label)).not.toContain("Publicación de unidades en venta");
  });

  it("validates and normalizes a complete access request payload", () => {
    const result = accessRequestSchema.safeParse({
      companyName: "  Inmobiliaria Norte  ",
      contactName: "  Sofía Pérez  ",
      email: "SOFIA@EXAMPLE.COM ",
      phone: " +54 11 5555-5555 ",
      rentalAdministrationUnits: 49,
      saleUnits: 7,
      users: 2,
      selectedModules: ["RENTALS_AND_CONTRACTS", "SALE_UNIT_MANAGEMENT"],
      turnstileToken: "turnstile-token"
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.companyName).toBe("Inmobiliaria Norte");
    expect(result.data.email).toBe("sofia@example.com");
    expect(result.data.selectedModules).toEqual(["RENTALS_AND_CONTRACTS", "SALE_UNIT_MANAGEMENT"]);
  });
});
