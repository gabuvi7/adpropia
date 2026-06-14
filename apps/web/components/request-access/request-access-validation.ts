import {
  accessRequestSchema,
  type AccessPlanRecommendationInput,
  type AccessRequestInput,
} from "@adpropia/shared";

export type FormState = "idle" | "submitting" | "success" | "error";
export type RequestAccessField = keyof AccessRequestInput;
export type VisibleRequestAccessField = Exclude<
  RequestAccessField,
  "selectedModules"
>;
export type ContactFieldId = Extract<
  RequestAccessField,
  "companyName" | "contactName" | "email" | "phone"
>;
export type FieldErrors = Partial<Record<VisibleRequestAccessField, string>>;
export type PublicAccessRequestPayload = Omit<
  AccessRequestInput,
  "selectedModules"
>;
export type NumericInputState = Record<
  keyof AccessPlanRecommendationInput,
  string
>;

export type RequestAccessFormProps = Readonly<{
  turnstileSiteKey: string;
  initialValues?: Partial<AccessPlanRecommendationInput>;
}>;

export const defaultValues: AccessPlanRecommendationInput = {
  rentalAdministrationUnits: 50,
  saleUnits: 0,
  users: 2,
};

export const numericFieldMinimums = {
  rentalAdministrationUnits: 0,
  saleUnits: 0,
  users: 1,
} as const satisfies Record<keyof AccessPlanRecommendationInput, number>;

const fieldErrorMessages = {
  companyName: "Ingresá el nombre de la inmobiliaria.",
  contactName: "Ingresá el nombre de contacto.",
  email: "Ingresá un email válido.",
  phone: "Ingresá un teléfono válido con al menos 7 números.",
  rentalAdministrationUnits:
    "Ingresá una cantidad válida de alquileres o administraciones.",
  saleUnits: "Ingresá una cantidad válida de unidades en venta.",
  users: "Ingresá al menos 1 usuario.",
  turnstileToken: "Completá la verificación anti-spam.",
} as const satisfies Record<VisibleRequestAccessField, string>;

export function getRequestAccessFieldErrors(
  payload: PublicAccessRequestPayload,
  numericDrafts: NumericInputState,
) {
  const errors: FieldErrors = {};

  for (const field of Object.keys(numericDrafts) as Array<
    keyof NumericInputState
  >) {
    if (numericDrafts[field].trim() === "") {
      errors[field] = fieldErrorMessages[field];
    }
  }

  const result = accessRequestSchema.safeParse({
    ...payload,
    selectedModules: ["RENTALS_AND_CONTRACTS"],
  });
  if (!result.success) {
    for (const issue of result.error.issues) {
      const [field] = issue.path;
      if (typeof field !== "string" || !(field in fieldErrorMessages)) continue;

      const requestField = field as VisibleRequestAccessField;
      errors[requestField] ??= fieldErrorMessages[requestField];
    }
  }

  return errors;
}

export function toNumericInputState(
  input: AccessPlanRecommendationInput,
): NumericInputState {
  return {
    rentalAdministrationUnits: String(
      normalizeNumericDraft(
        String(input.rentalAdministrationUnits),
        numericFieldMinimums.rentalAdministrationUnits,
      ),
    ),
    saleUnits: String(
      normalizeNumericDraft(
        String(input.saleUnits),
        numericFieldMinimums.saleUnits,
      ),
    ),
    users: String(
      normalizeNumericDraft(String(input.users), numericFieldMinimums.users),
    ),
  };
}

export function sanitizeNumericDraft(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizeNumericDraft(value: string, minimum: number) {
  const digitsOnly = sanitizeNumericDraft(value);
  if (digitsOnly === "") return minimum;

  return Math.max(minimum, Number(digitsOnly));
}

export function normalizeAccessPlanInput(
  input: NumericInputState,
): AccessPlanRecommendationInput {
  return {
    rentalAdministrationUnits: normalizeNumericDraft(
      input.rentalAdministrationUnits,
      numericFieldMinimums.rentalAdministrationUnits,
    ),
    saleUnits: normalizeNumericDraft(
      input.saleUnits,
      numericFieldMinimums.saleUnits,
    ),
    users: normalizeNumericDraft(input.users, numericFieldMinimums.users),
  };
}
