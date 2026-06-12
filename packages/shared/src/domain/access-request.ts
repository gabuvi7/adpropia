import { z } from "zod";

export const accessPlans = ["INICIAL", "PROFESIONAL", "OPERATIVO", "A_MEDIDA"] as const;
export type AccessPlan = (typeof accessPlans)[number];

export const accessPlanLabels: Record<AccessPlan, string> = {
  INICIAL: "Inicial",
  PROFESIONAL: "Profesional",
  OPERATIVO: "Operativo",
  A_MEDIDA: "A medida"
};

export const accessRequestModuleValues = [
  "RENTALS_AND_CONTRACTS",
  "INDEXES_AND_ADJUSTMENTS",
  "COLLECTIONS_PAYMENTS_CASH",
  "OWNER_LIQUIDATIONS",
  "REPORTS_AND_AUDIT",
  "SALE_UNIT_MANAGEMENT",
  "AUTOMATIONS_AND_REMINDERS"
] as const;

export type AccessRequestModule = (typeof accessRequestModuleValues)[number];

export const accessRequestModules: ReadonlyArray<{ value: AccessRequestModule; label: string }> = [
  { value: "RENTALS_AND_CONTRACTS", label: "Alquileres y contratos" },
  { value: "INDEXES_AND_ADJUSTMENTS", label: "Índices y ajustes" },
  { value: "COLLECTIONS_PAYMENTS_CASH", label: "Cobros, pagos y caja" },
  { value: "OWNER_LIQUIDATIONS", label: "Liquidaciones a propietarios" },
  { value: "REPORTS_AND_AUDIT", label: "Reportes y auditoría" },
  { value: "SALE_UNIT_MANAGEMENT", label: "Gestión de unidades en venta" },
  { value: "AUTOMATIONS_AND_REMINDERS", label: "Automatismos y recordatorios" }
];

const requiredTrimmedString = (fieldName: string, maxLength: number) =>
  z.string().trim().min(1, `${fieldName} is required`).max(maxLength, `${fieldName} is too long`);

export const accessRequestSchema = z.object({
  companyName: requiredTrimmedString("companyName", 120),
  contactName: requiredTrimmedString("contactName", 120),
  email: z.string().trim().toLowerCase().email("email must be valid").max(160, "email is too long"),
  phone: requiredTrimmedString("phone", 60),
  rentalAdministrationUnits: z.coerce.number().int().min(0).max(100_000),
  saleUnits: z.coerce.number().int().min(0).max(100_000),
  users: z.coerce.number().int().min(1).max(10_000),
  selectedModules: z.array(z.enum(accessRequestModuleValues)).min(1, "selectedModules is required"),
  turnstileToken: requiredTrimmedString("turnstileToken", 4096)
}).strict();

export type AccessRequestInput = z.infer<typeof accessRequestSchema>;

export type AccessPlanRecommendationInput = Pick<
  AccessRequestInput,
  "rentalAdministrationUnits" | "saleUnits" | "users"
>;

export type AccessPlanRecommendation = Readonly<{
  plan: AccessPlan;
  label: string;
  rentalAdministrationUnits: number;
  users: number;
  saleUnitsCapturedSeparately: number;
  message: string;
}>;

export function recommendAccessPlan(input: AccessPlanRecommendationInput): AccessPlanRecommendation {
  const plan = resolveAccessPlan(input.rentalAdministrationUnits, input.users);

  return {
    plan,
    label: accessPlanLabels[plan],
    rentalAdministrationUnits: input.rentalAdministrationUnits,
    users: input.users,
    saleUnitsCapturedSeparately: input.saleUnits,
    message: `Plan recomendado: ${accessPlanLabels[plan]}. La confirmación final queda sujeta a revisión comercial.`
  };
}

function resolveAccessPlan(rentalAdministrationUnits: number, users: number): AccessPlan {
  if (rentalAdministrationUnits <= 50 && users <= 2) return "INICIAL";
  if (rentalAdministrationUnits <= 200 && users <= 5) return "PROFESIONAL";
  if (rentalAdministrationUnits <= 500 && users <= 10) return "OPERATIVO";
  return "A_MEDIDA";
}
