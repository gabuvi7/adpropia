import { describe, expect, it } from "vitest";
import {
  accessPlanDisplayMetadata,
  accessPlanLabels,
  accessRequestModules,
  accessRequestSchema,
  recommendAccessPlan
} from "./access-request";
import { publicPricingPlansById, publicPricingTerms } from "./public-pricing";

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

  it("exposes public monthly prices and plan benefits from shared metadata", () => {
    const recommendation = recommendAccessPlan({ rentalAdministrationUnits: 180, saleUnits: 15, users: 5 });

    expect(recommendation.display).toBe(publicPricingPlansById.PROFESIONAL);
    expect(recommendation.display.monthlyPriceLabel).toBe("ARS 119.000/mes");
    expect(recommendation.display.benefits).toContain("Hasta 200 unidades en alquiler/administración.");
    expect(recommendation.display.benefits).toContain("Liquidaciones, reportes y automatismos para bajar tareas repetidas.");
    expect(recommendation.message).toContain("Te recomendamos el plan Profesional como punto de partida");
    expect(recommendation.message).toContain("Este precio te sirve como referencia");
    expect(accessPlanDisplayMetadata.INICIAL.monthlyPriceLabel).toBe("ARS 49.000/mes");
    expect(accessPlanDisplayMetadata.INICIAL).toBe(publicPricingPlansById.INICIAL);
    expect(accessPlanDisplayMetadata.OPERATIVO.monthlyPriceLabel).toBe("ARS 229.000/mes");
    expect(accessPlanDisplayMetadata.A_MEDIDA.monthlyPriceLabel).toBe("Consultar");
  });

  it("exposes the 20% launch promo for fixed-price public plans", () => {
    expect(publicPricingTerms.monthlyPromo).toEqual({ percentOff: 20, durationMonths: 3, stackable: false });
    expect(accessPlanDisplayMetadata.INICIAL.promo).toMatchObject({
      label: "20% menos los primeros 3 meses",
      durationMonths: 3,
      discountedPriceCents: 39_200_00,
      percentOff: 20
    });
    expect(accessPlanDisplayMetadata.PROFESIONAL.promo?.discountedPriceCents).toBe(95_200_00);
    expect(accessPlanDisplayMetadata.OPERATIVO.promo?.discountedPriceCents).toBe(183_200_00);
    expect(accessPlanDisplayMetadata.A_MEDIDA.promo).toBeUndefined();
  });

  it("explains why a plan is recommended and when the next threshold applies", () => {
    const recommendation = recommendAccessPlan({ rentalAdministrationUnits: 180, saleUnits: 15, users: 5 });

    expect(recommendation.whyThisPlan).toBe(
      "Tu operación entra en este tramo por 180 unidades de alquiler/administración y 5 usuarios."
    );
    expect(recommendation.nextThresholdHint).toBe(
      "Si superás 200 unidades o 5 usuarios, pasás al siguiente plan."
    );
    expect(recommendation.saleUnitsNote).toBe(
      "15 unidades en venta quedan registradas aparte: no suben el plan recomendado."
    );
  });

  it("explains A medida without exposing a fixed promo", () => {
    const recommendation = recommendAccessPlan({ rentalAdministrationUnits: 501, saleUnits: 30, users: 10 });

    expect(recommendation.plan).toBe("A_MEDIDA");
    expect(recommendation.display.monthlyPriceLabel).toBe("Consultar");
    expect(recommendation.display.promo).toBeUndefined();
    expect(recommendation.whyThisPlan).toContain("supera los tramos públicos");
    expect(recommendation.nextThresholdHint).toBeUndefined();
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
