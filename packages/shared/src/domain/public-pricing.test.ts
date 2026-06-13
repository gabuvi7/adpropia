import { describe, expect, it } from "vitest";
import {
  getFixedPlanDiscountedPriceCents,
  publicPricingAddOns,
  publicPricingFaq,
  publicPricingPlans,
  publicPricingPlansById,
  publicPricingTerms,
  publicPricingWhatsAppUseCases
} from "./public-pricing";

describe("public pricing domain", () => {
  it("exposes public fixed-price plans and A medida in the published order", () => {
    expect(publicPricingPlans.map((plan) => plan.id)).toEqual(["INICIAL", "PROFESIONAL", "OPERATIVO", "A_MEDIDA"]);
    expect(publicPricingPlans.map((plan) => plan.monthlyPriceLabel)).toEqual([
      "ARS 49.000/mes",
      "ARS 119.000/mes",
      "ARS 229.000/mes",
      "Consultar"
    ]);
    expect(publicPricingPlans[0]).toMatchObject({
      id: "INICIAL",
      monthlyPriceCents: 49_000_00,
      thresholds: { maxRentalAdministrationUnits: 50, maxUsers: 2 }
    });
    expect(publicPricingPlans[1]).toMatchObject({
      id: "PROFESIONAL",
      monthlyPriceCents: 119_000_00,
      thresholds: { maxRentalAdministrationUnits: 200, maxUsers: 5 }
    });
    expect(publicPricingPlans[2]).toMatchObject({
      id: "OPERATIVO",
      monthlyPriceCents: 229_000_00,
      thresholds: { maxRentalAdministrationUnits: 500, maxUsers: 10 }
    });
  });

  it("applies the monthly promo only to fixed-price plans", () => {
    expect(publicPricingTerms.monthlyPromo).toEqual({ percentOff: 20, durationMonths: 3, stackable: false });
    expect(getFixedPlanDiscountedPriceCents("INICIAL", "monthlyPromo")).toBe(39_200_00);
    expect(getFixedPlanDiscountedPriceCents("PROFESIONAL", "monthlyPromo")).toBe(95_200_00);
    expect(getFixedPlanDiscountedPriceCents("OPERATIVO", "monthlyPromo")).toBe(183_200_00);
    expect(getFixedPlanDiscountedPriceCents("A_MEDIDA", "monthlyPromo")).toBeUndefined();
  });

  it("keeps annual pricing as a non-stackable discount with twelve-month price freeze", () => {
    expect(publicPricingTerms.annual).toEqual({ percentOff: 15, priceFreezeMonths: 12, stackable: false });
    expect(getFixedPlanDiscountedPriceCents("INICIAL", "annual")).toBe(41_650_00);
    expect(getFixedPlanDiscountedPriceCents("PROFESIONAL", "annual")).toBe(101_150_00);
    expect(getFixedPlanDiscountedPriceCents("OPERATIVO", "annual")).toBe(194_650_00);
    expect(publicPricingTerms.discountCompatibilityNote).toBe(
      "Los descuentos no son acumulables: la promo mensual no se combina con el descuento anual."
    );
  });

  it("publishes sale units as a separated add-on", () => {
    expect(publicPricingAddOns.saleUnits).toMatchObject({
      label: "Unidades en venta",
      freeMonths: 6,
      monthlyPricePerUnitCents: 1_500_00,
      monthlyPricePerUnitLabel: "ARS 1.500/unidad"
    });
    expect(publicPricingAddOns.saleUnits.description).toContain("adicional separado");
  });

  it("positions WhatsApp as operational reminders, not a generic CRM inbox", () => {
    expect(publicPricingAddOns.whatsappOperations).toMatchObject({
      label: "Integración operativa por WhatsApp",
      freeMonths: 3,
      monthlyPriceCents: 30_000_00,
      monthlyPriceLabel: "ARS 30.000/mes"
    });
    expect(publicPricingWhatsAppUseCases).toEqual([
      "Recordatorios de vencimiento de alquiler",
      "Avisos de pago o mora",
      "Recordatorios de ajuste",
      "Avisos a propietarios y liquidaciones"
    ]);
    expect(publicPricingAddOns.whatsappOperations.positioningNote).not.toMatch(/crm|inbox/i);
  });

  it("keeps A medida consultative and excludes fixed-price promo metadata", () => {
    const customPlan = publicPricingPlansById.A_MEDIDA;

    expect(customPlan.monthlyPriceCents).toBeUndefined();
    expect(customPlan.promo).toBeUndefined();
    expect(customPlan.annualDiscount).toBeUndefined();
    expect(customPlan.benefits).toContain("Alcance definido según volumen operativo y forma de trabajo.");
  });

  it("provides FAQ and operational copy without prohibited public claims", () => {
    const publicCopy = [
      ...publicPricingFaq.flatMap((item) => [item.question, item.answer]),
      ...publicPricingPlans.flatMap((plan) => [plan.label, plan.monthlyPriceLabel, ...plan.benefits]),
      publicPricingAddOns.whatsappOperations.description,
      publicPricingAddOns.whatsappOperations.positioningNote
    ].join(" ");

    expect(publicCopy).toContain("no son acumulables");
    expect(publicCopy).not.toMatch(/multi-cliente/i);
    expect(publicCopy).not.toMatch(/activaci[oó]n asistida/i);
  });
});
