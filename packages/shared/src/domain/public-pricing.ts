import type { AccessPlan } from "./access-request";

export type PublicPricingPlan = Readonly<{
  id: AccessPlan;
  label: string;
  monthlyPriceLabel: string;
  monthlyPriceCents?: number;
  thresholds?: PublicPricingPlanThreshold;
  promo?: PublicPricingPlanPromo;
  annualDiscount?: PublicPricingAnnualTerms;
  benefits: readonly string[];
}>;

export type PublicPricingPlanThreshold = Readonly<{
  maxRentalAdministrationUnits: number;
  maxUsers: number;
}>;

export type PublicPricingPlanPromo = Readonly<{
  label: string;
  durationMonths: number;
  discountedPriceCents: number;
  percentOff: number;
  note: string;
}>;

export type PublicPricingAnnualTerms = Readonly<{
  percentOff: 15;
  priceFreezeMonths: 12;
  stackable: false;
}>;

export type PublicPricingTerms = Readonly<{
  monthlyPromo: {
    percentOff: 20;
    durationMonths: 3;
    stackable: false;
  };
  annual: PublicPricingAnnualTerms;
  discountCompatibilityNote: string;
}>;

export type PublicPricingAddOns = Readonly<{
  saleUnits: {
    label: string;
    freeMonths: number;
    monthlyPricePerUnitCents: number;
    monthlyPricePerUnitLabel: string;
    description: string;
  };
  whatsappOperations: {
    label: string;
    freeMonths: number;
    monthlyPriceCents: number;
    monthlyPriceLabel: string;
    description: string;
    positioningNote: string;
  };
}>;

export type PublicPricingFaqItem = Readonly<{
  question: string;
  answer: string;
}>;

export const publicPricingTerms: PublicPricingTerms = {
  monthlyPromo: { percentOff: 20, durationMonths: 3, stackable: false },
  annual: { percentOff: 15, priceFreezeMonths: 12, stackable: false },
  discountCompatibilityNote: "Los descuentos no son acumulables: la promo mensual no se combina con el descuento anual."
};

const fixedPublicPricingPlans = [
  {
    id: "INICIAL",
    label: "Inicial",
    monthlyPriceLabel: "ARS 49.000/mes",
    monthlyPriceCents: 49_000_00,
    thresholds: { maxRentalAdministrationUnits: 50, maxUsers: 2 },
    benefits: [
      "Hasta 50 unidades en alquiler/administración.",
      "Hasta 2 usuarios para trabajar el día a día.",
      "Contratos, ajustes, cobros y seguimiento operativo en un solo lugar."
    ]
  },
  {
    id: "PROFESIONAL",
    label: "Profesional",
    monthlyPriceLabel: "ARS 119.000/mes",
    monthlyPriceCents: 119_000_00,
    thresholds: { maxRentalAdministrationUnits: 200, maxUsers: 5 },
    benefits: [
      "Hasta 200 unidades en alquiler/administración.",
      "Hasta 5 usuarios para coordinar el equipo.",
      "Liquidaciones, reportes y automatismos para bajar tareas repetidas."
    ]
  },
  {
    id: "OPERATIVO",
    label: "Operativo",
    monthlyPriceLabel: "ARS 229.000/mes",
    monthlyPriceCents: 229_000_00,
    thresholds: { maxRentalAdministrationUnits: 500, maxUsers: 10 },
    benefits: [
      "Hasta 500 unidades en alquiler/administración.",
      "Hasta 10 usuarios para equipos con mayor volumen.",
      "Más control para revisar reportes, auditoría y recordatorios sin perder trazabilidad."
    ]
  }
] as const satisfies ReadonlyArray<PublicPricingPlan & { monthlyPriceCents: number }>;

export const publicPricingPlans = [
  ...fixedPublicPricingPlans.map((plan) => ({
    ...plan,
    promo: createMonthlyPromo(plan.monthlyPriceCents),
    annualDiscount: publicPricingTerms.annual
  })),
  {
    id: "A_MEDIDA",
    label: "A medida",
    monthlyPriceLabel: "Consultar",
    benefits: [
      "Para operaciones que superan 500 unidades o 10 usuarios.",
      "Alcance definido según volumen operativo y forma de trabajo.",
      "Lo revisamos juntos antes de confirmar condiciones finales."
    ]
  }
] as const satisfies ReadonlyArray<PublicPricingPlan>;

export const publicPricingPlansById = Object.fromEntries(
  publicPricingPlans.map((plan) => [plan.id, plan])
) as unknown as Record<AccessPlan, PublicPricingPlan>;

export const publicPricingAddOns: PublicPricingAddOns = {
  saleUnits: {
    label: "Unidades en venta",
    freeMonths: 6,
    monthlyPricePerUnitCents: 1_500_00,
    monthlyPricePerUnitLabel: "ARS 1.500/unidad",
    description: "Las unidades en venta se toman como adicional separado: gratis los primeros 6 meses y luego ARS 1.500 por unidad."
  },
  whatsappOperations: {
    label: "Integración operativa por WhatsApp",
    freeMonths: 3,
    monthlyPriceCents: 30_000_00,
    monthlyPriceLabel: "ARS 30.000/mes",
    description: "Gratis los primeros 3 meses y luego ARS 30.000 por mes para recordatorios operativos.",
    positioningNote:
      "Pensado para vencimientos, pagos, mora, ajustes y avisos a propietarios o liquidaciones; no reemplaza herramientas conversacionales generalistas."
  }
};

export const publicPricingWhatsAppUseCases = [
  "Recordatorios de vencimiento de alquiler",
  "Avisos de pago o mora",
  "Recordatorios de ajuste",
  "Avisos a propietarios y liquidaciones"
] as const;

export const publicPricingFaq: readonly PublicPricingFaqItem[] = [
  {
    question: "¿Los descuentos se pueden combinar?",
    answer: publicPricingTerms.discountCompatibilityNote
  },
  {
    question: "¿Las unidades en venta cambian el plan base?",
    answer:
      "No. El dimensionamiento base usa unidades de alquiler/administración y usuarios; las unidades en venta se calculan como adicional separado."
  },
  {
    question: "¿Qué cubre WhatsApp operativo?",
    answer:
      "Cubre recordatorios de vencimiento, avisos de pago o mora, ajustes y avisos a propietarios o liquidaciones."
  }
];

export function getFixedPlanDiscountedPriceCents(
  plan: AccessPlan,
  discount: "monthlyPromo" | "annual"
): number | undefined {
  const monthlyPriceCents = publicPricingPlansById[plan].monthlyPriceCents;
  if (!monthlyPriceCents) return undefined;

  return calculateDiscountedPriceCents(monthlyPriceCents, publicPricingTerms[discount].percentOff);
}

function createMonthlyPromo(monthlyPriceCents: number): PublicPricingPlanPromo {
  return {
    label: "20% menos los primeros 3 meses",
    durationMonths: publicPricingTerms.monthlyPromo.durationMonths,
    discountedPriceCents: calculateDiscountedPriceCents(monthlyPriceCents, publicPricingTerms.monthlyPromo.percentOff),
    percentOff: publicPricingTerms.monthlyPromo.percentOff,
    note: "Promoción de lanzamiento para planes con precio público mensual. No acumulable con el descuento anual."
  };
}

function calculateDiscountedPriceCents(monthlyPriceCents: number, percentOff: number) {
  return Math.round((monthlyPriceCents * (100 - percentOff)) / 100);
}
