"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { recommendAccessPlan, type AccessPlanRecommendationInput } from "@adpropia/shared";
import {
  ContextFields,
  Field,
  Fieldset,
  NumberField,
} from "./request-access-fields";
import { RequestFooter } from "./request-access-footer";
import { LiveQuoteBand, PlanPromo } from "./request-access-quote";
import {
  defaultValues,
  getRequestAccessFieldErrors,
  normalizeAccessPlanInput,
  normalizeNumericDraft,
  numericFieldMinimums,
  sanitizeNumericDraft,
  toNumericInputState,
  type FieldErrors,
  type FormState,
  type PublicAccessRequestPayload,
  type RequestAccessFormProps,
  type VisibleRequestAccessField,
} from "./request-access-validation";

export { PlanPromo };
export {
  normalizeAccessPlanInput,
  normalizeNumericDraft,
  sanitizeNumericDraft,
} from "./request-access-validation";
export type { NumericInputState } from "./request-access-validation";

export function RequestAccessForm({
  turnstileSiteKey,
  initialValues,
}: RequestAccessFormProps) {
  const initialUnits = { ...defaultValues, ...initialValues };
  const [numericInputs, setNumericInputs] = useState(() =>
    toNumericInputState(initialUnits),
  );
  const [status, setStatus] = useState<FormState>("idle");
  const [message, setMessage] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const normalizedUnits = useMemo(
    () => normalizeAccessPlanInput(numericInputs),
    [numericInputs],
  );
  const recommendation = useMemo(
    () => recommendAccessPlan(normalizedUnits),
    [normalizedUnits],
  );

  function updateNumericInput(
    id: keyof AccessPlanRecommendationInput,
    value: string,
  ) {
    clearFieldError(id);
    setNumericInputs((current) => ({
      ...current,
      [id]: sanitizeNumericDraft(value),
    }));
  }

  function clearFieldError(id: VisibleRequestAccessField) {
    setFieldErrors((current) => {
      if (!current[id]) return current;
      const { [id]: _removed, ...rest } = current;
      return rest;
    });
  }

  function commitNumericInput(id: keyof AccessPlanRecommendationInput) {
    setNumericInputs((current) => ({
      ...current,
      [id]: String(
        normalizeNumericDraft(current[id], numericFieldMinimums[id]),
      ),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const submittedUnits = normalizeAccessPlanInput(numericInputs);
    const payload: PublicAccessRequestPayload = {
      companyName: String(formData.get("companyName") ?? ""),
      contactName: String(formData.get("contactName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      rentalAdministrationUnits: submittedUnits.rentalAdministrationUnits,
      saleUnits: submittedUnits.saleUnits,
      users: submittedUnits.users,
      turnstileToken: String(
        formData.get("cf-turnstile-response") ??
          formData.get("turnstileToken") ??
          "",
      ),
    };

    const validationErrors = getRequestAccessFieldErrors(
      payload,
      numericInputs,
    );

    if (Object.keys(validationErrors).length > 0) {
      setStatus("error");
      setMessage("Revisá los campos marcados antes de enviar.");
      setFieldErrors(validationErrors);
      return;
    }

    setFieldErrors({});
    setNumericInputs(toNumericInputState(submittedUnits));

    const response = await fetch("/api/access-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      setStatus("error");
      setMessage(
        "No pudimos enviar la solicitud. Revisá los datos y la verificación anti-spam.",
      );
      return;
    }

    setStatus("success");
    setMessage(
      "Recibimos tu solicitud. El equipo revisará el plan recomendado y te contactará.",
    );
  }

  return (
    <form
      action="/api/access-requests"
      method="POST"
      noValidate
      onSubmit={handleSubmit}
      className="grid gap-10"
      aria-describedby="request-access-status request-access-note"
    >
      <Fieldset
        eyebrow="Cotizador en vivo"
        title="Tres datos para recomendarte un punto de partida"
        description="Alquileres/administración y usuarios definen el tramo. Las unidades en venta se registran aparte y quedan incluidas sin cargo durante los primeros 6 meses."
      >
        <div className="grid min-w-0 gap-7">
          <div className="grid min-w-0 gap-5 md:grid-cols-3">
            <NumberField
              id="rentalAdministrationUnits"
              label="Alquileres / administración"
              help="Mueve el tramo principal del plan."
              value={numericInputs.rentalAdministrationUnits}
              error={fieldErrors.rentalAdministrationUnits}
              onChange={(value) =>
                updateNumericInput("rentalAdministrationUnits", value)
              }
              onBlur={() => commitNumericInput("rentalAdministrationUnits")}
            />
            <NumberField
              id="users"
              label="Usuarios"
              help="Personas que operan contratos, cobros y reportes."
              value={numericInputs.users}
              error={fieldErrors.users}
              onChange={(value) => updateNumericInput("users", value)}
              onBlur={() => commitNumericInput("users")}
            />
            <NumberField
              id="saleUnits"
              label="Unidades en venta"
              help="Se registran aparte y no suben el plan inicial."
              value={numericInputs.saleUnits}
              error={fieldErrors.saleUnits}
              onChange={(value) => updateNumericInput("saleUnits", value)}
              onBlur={() => commitNumericInput("saleUnits")}
            />
          </div>
          <LiveQuoteBand recommendation={recommendation} />
        </div>
      </Fieldset>

      <Fieldset
        eyebrow="Contexto opcional"
        title="Contanos qué querés ordenar primero"
        description="Esta respuesta no cambia el plan recomendado ni el precio. Sólo ayuda al equipo comercial a entender prioridades antes de contactarte."
      >
        <ContextFields />
      </Fieldset>

      <Fieldset
        eyebrow="Contacto"
        title="Dejanos tus datos para revisar la referencia"
        description="Después confirmamos juntos si el plan y el precio encajan con tu operación, sin crear accesos automáticamente."
      >
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Field
            id="companyName"
            label="Inmobiliaria"
            autoComplete="organization"
            error={fieldErrors.companyName}
            onChange={() => clearFieldError("companyName")}
          />
          <Field
            id="contactName"
            label="Nombre de contacto"
            autoComplete="name"
            error={fieldErrors.contactName}
            onChange={() => clearFieldError("contactName")}
          />
          <Field
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            error={fieldErrors.email}
            onChange={() => clearFieldError("email")}
          />
          <Field
            id="phone"
            label="WhatsApp o teléfono"
            type="tel"
            autoComplete="tel"
            error={fieldErrors.phone}
            onChange={() => clearFieldError("phone")}
          />
        </div>
        <RequestFooter
          turnstileSiteKey={turnstileSiteKey}
          status={status}
          message={message}
          turnstileError={fieldErrors.turnstileToken}
        />
      </Fieldset>
    </form>
  );
}
