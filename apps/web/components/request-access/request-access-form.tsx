"use client";

import type { FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  recommendAccessPlan,
  type AccessPlanPromoMetadata,
  type AccessPlanRecommendationInput,
  type AccessRequestInput,
} from "@adpropia/shared";

type FormState = "idle" | "submitting" | "success" | "error";
export type NumericInputState = Record<
  keyof AccessPlanRecommendationInput,
  string
>;

export type RequestAccessFormProps = Readonly<{
  turnstileSiteKey: string;
  initialValues?: Partial<AccessPlanRecommendationInput>;
}>;

const defaultValues: AccessPlanRecommendationInput = {
  rentalAdministrationUnits: 50,
  saleUnits: 0,
  users: 2,
};

const numericFieldMinimums = {
  rentalAdministrationUnits: 0,
  saleUnits: 0,
  users: 1,
} as const satisfies Record<keyof AccessPlanRecommendationInput, number>;

export function RequestAccessForm({
  turnstileSiteKey,
  initialValues,
}: RequestAccessFormProps) {
  const initialUnits = { ...defaultValues, ...initialValues };
  const [numericInputs, setNumericInputs] = useState<NumericInputState>(() =>
    toNumericInputState(initialUnits),
  );
  const [status, setStatus] = useState<FormState>("idle");
  const [message, setMessage] = useState<string>("");

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
    setNumericInputs((current) => ({
      ...current,
      [id]: sanitizeNumericDraft(value),
    }));
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
    setNumericInputs(toNumericInputState(submittedUnits));

    const payload: AccessRequestInput = {
      companyName: String(formData.get("companyName") ?? ""),
      contactName: String(formData.get("contactName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      rentalAdministrationUnits: submittedUnits.rentalAdministrationUnits,
      saleUnits: submittedUnits.saleUnits,
      users: submittedUnits.users,
      selectedModules: ["RENTALS_AND_CONTRACTS"],
      turnstileToken: String(
        formData.get("cf-turnstile-response") ??
          formData.get("turnstileToken") ??
          "",
      ),
    };

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
      onSubmit={handleSubmit}
      className="grid gap-6"
      aria-describedby="request-access-status request-access-note"
    >
      <Fieldset
        eyebrow="Cotizador en vivo"
        title="Tres datos para recomendarte un punto de partida"
        description="Alquileres/administración y usuarios definen el tramo. Las unidades en venta se registran aparte y quedan incluidas sin cargo durante los primeros 6 meses."
      >
        <div className="grid min-w-0 gap-4">
          <div className="grid min-w-0 gap-4 md:grid-cols-3">
            <NumberField
              id="rentalAdministrationUnits"
              label="Alquileres / administración"
              help="Mueve el tramo principal del plan."
              value={numericInputs.rentalAdministrationUnits}
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
              onChange={(value) => updateNumericInput("users", value)}
              onBlur={() => commitNumericInput("users")}
            />
            <NumberField
              id="saleUnits"
              label="Unidades en venta"
              help="Se registran aparte y no suben el plan inicial."
              value={numericInputs.saleUnits}
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
        <label
          className="grid min-w-0 gap-2 text-sm font-semibold text-[#0b1738]"
          htmlFor="operationPriorities"
        >
          Prioridades o dudas principales
          <textarea
            id="operationPriorities"
            name="operationPriorities"
            rows={4}
            maxLength={600}
            className="landing-focus min-h-28 w-full min-w-0 resize-y border border-[#0b1738]/20 px-3 py-3 text-base font-medium leading-7 text-[#0b1738] outline-none transition-colors duration-200 hover:border-[#0355e8]/60"
            aria-describedby="operationPriorities-help"
          />
          <span
            id="operationPriorities-help"
            className="landing-pretty text-sm font-normal leading-6 text-[#0b1738]/65"
          >
            Ejemplo: contratos, cobros, liquidaciones, reportes o seguimiento de
            ventas. No es un selector de módulos ni modifica la cotización.
          </span>
        </label>
      </Fieldset>

      <Fieldset
        eyebrow="Contacto"
        title="Dejanos tus datos para revisar la referencia"
        description="Después confirmamos juntos si el plan y el precio encajan con tu operación, sin crear accesos automáticamente."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="companyName" label="Empresa" autoComplete="organization" />
          <Field
            id="contactName"
            label="Nombre de contacto"
            autoComplete="name"
          />
          <Field id="email" label="Email" type="email" autoComplete="email" />
          <Field
            id="phone"
            label="WhatsApp o teléfono"
            type="tel"
            autoComplete="tel"
          />
        </div>
        <RequestFooter
          turnstileSiteKey={turnstileSiteKey}
          status={status}
          message={message}
        />
      </Fieldset>
    </form>
  );
}

function Fieldset({
  eyebrow,
  title,
  description,
  children,
}: Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}>) {
  return (
    <fieldset className="grid min-w-0 gap-5 border border-[#0b1738]/10 bg-white p-5 shadow-xl shadow-[#0355e8]/8 sm:p-6">
      <legend className="-ml-1 px-1">
        <span className="block text-xs font-bold uppercase tracking-[0.24em] text-[#0355e8]">
          {eyebrow}
        </span>
        <span className="mt-2 block text-2xl font-semibold tracking-[-0.045em] text-[#0b1738]">
          {title}
        </span>
      </legend>
      <p className="landing-pretty max-w-3xl text-sm leading-6 text-[#0b1738]/70">
        {description}
      </p>
      {children}
    </fieldset>
  );
}

function LiveQuoteBand({
  recommendation,
}: Readonly<{ recommendation: ReturnType<typeof recommendAccessPlan> }>) {
  const promoPriceLabel = getPromoPriceLabel(recommendation.display.promo);

  return (
    <section
      aria-labelledby="recommendation-title"
      className="grid min-w-0 gap-4 border border-[#0355e8]/25 bg-[linear-gradient(135deg,#f5f9ff_0%,#ffffff_58%,#eef6ff_100%)] p-4 text-[#0b1738] shadow-lg shadow-[#0355e8]/10 sm:p-5"
    >
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-center">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#0355e8]">
            Cotización en vivo
          </p>
          <h2
            id="recommendation-title"
            className="mt-2 text-3xl font-semibold tracking-[-0.055em] text-[#0b1738]"
          >
            Plan {recommendation.label}
          </h2>
          <p className="landing-pretty mt-2 text-sm leading-6 text-[#0b1738]/75">
            Por {recommendation.rentalAdministrationUnits} unidades de
            alquiler/administración y {recommendation.users} usuarios.
          </p>
        </div>

        <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
          {promoPriceLabel ? (
            <PriceTerm
              label="Primeros 3 meses"
              value={promoPriceLabel}
              note={
                recommendation.display.promo?.label ?? "Promo de lanzamiento"
              }
              featured
            />
          ) : null}
          <PriceTerm
            label={
              promoPriceLabel ? "Después de la promo" : "Precio de referencia"
            }
            value={recommendation.display.monthlyPriceLabel}
            note={
              promoPriceLabel
                ? "Precio regular de referencia"
                : "Requiere revisión comercial"
            }
            featured={!promoPriceLabel}
          />
        </dl>
      </div>

      <div className="grid min-w-0 gap-3 border-t border-[#0355e8]/15 pt-4">
        <div className="flex min-w-0 flex-wrap gap-2">
          <ReasonChip value={recommendation.whyThisPlan} />
          {recommendation.nextThresholdHint ? (
            <ReasonChip value={recommendation.nextThresholdHint} />
          ) : null}
          <ReasonChip value={recommendation.saleUnitsNote} />
        </div>
      </div>

      <section
        aria-labelledby="plan-inclusions-title"
        className="grid min-w-0 gap-3 border border-[#0355e8]/15 bg-white/80 p-3"
      >
        <div className="grid min-w-0 gap-1 sm:grid-cols-[auto_1fr] sm:items-baseline sm:gap-3">
          <h3
            id="plan-inclusions-title"
            className="text-sm font-semibold text-[#0b1738]"
          >
            Incluye
          </h3>
          <p className="landing-pretty text-xs font-medium leading-5 text-[#0b1738]/60">
            Beneficios incluidos en el plan recomendado.
          </p>
        </div>
        <ul className="grid min-w-0 gap-2 text-sm leading-6 text-[#0b1738]/75 sm:grid-cols-3">
          {recommendation.display.benefits.map((benefit) => (
            <li
              key={benefit}
              className="grid min-w-0 grid-cols-[auto_1fr] gap-2 rounded-sm border border-[#0b1738]/10 bg-white px-3 py-2"
            >
              <span
                aria-hidden="true"
                className="mt-2 size-1.5 rounded-full bg-[#1472fa]"
              />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

function PriceTerm({
  label,
  value,
  note,
  featured = false,
}: Readonly<{
  label: string;
  value: string;
  note?: string;
  featured?: boolean;
}>) {
  return (
    <div
      className={`min-w-0 border px-3 py-3 ${featured ? "border-[#0355e8] bg-[#0355e8] text-white" : "border-[#0b1738]/10 bg-white text-[#0b1738]"}`}
    >
      <dt
        className={`text-[0.68rem] font-bold uppercase tracking-[0.18em] ${featured ? "text-white/75" : "text-[#0355e8]"}`}
      >
        {label}
      </dt>
      <dd className="mt-1 min-w-0 break-words text-2xl font-semibold tracking-[-0.045em]">
        {value}
      </dd>
      {note ? (
        <dd
          className={`mt-1 text-sm leading-6 ${featured ? "text-white/85" : "text-[#0b1738]/65"}`}
        >
          {note}
        </dd>
      ) : null}
    </div>
  );
}

function ReasonChip({ value }: Readonly<{ value: string }>) {
  return (
    <span className="landing-pretty inline-flex rounded-full border border-[#0355e8]/15 bg-white px-3 py-2 text-xs font-semibold leading-5 text-[#0b1738]/75">
      {value}
    </span>
  );
}

function RequestFooter({
  turnstileSiteKey,
  status,
  message,
}: Readonly<{ turnstileSiteKey: string; status: FormState; message: string }>) {
  return (
    <div className="grid gap-4 border-t border-[#0b1738]/10 pt-5 lg:grid-cols-[1fr_20rem] lg:items-end">
      <div>
        <p
          id="request-access-note"
          className="landing-pretty border-l-4 border-[#0355e8] bg-[#1472fa]/10 px-4 py-3 text-sm font-semibold leading-6 text-[#0b1738]"
        >
          Antes de enviar, tomá el plan recomendado como referencia. Las
          unidades en venta quedan incluidas sin cargo durante 6 meses y después
          se revisan con el equipo.
        </p>
        <div className="mt-4 grid gap-3">
          <input type="hidden" name="turnstileToken" />
          <div
            className="cf-turnstile min-h-16 border border-dashed border-[#0b1738]/25 bg-[#0b1738]/5 p-4 text-sm text-[#0b1738]/60"
            data-sitekey={turnstileSiteKey}
            aria-label="Verificación anti-spam de Cloudflare Turnstile"
          />
        </div>
      </div>
      <div>
        <button
          type="submit"
          disabled={status === "submitting"}
          className="landing-focus min-h-12 w-full bg-[#0355e8] px-6 text-sm font-semibold text-white shadow-lg shadow-[#0355e8]/20 transition-colors duration-200 hover:bg-[#1472fa] disabled:cursor-wait disabled:opacity-70"
        >
          {status === "submitting"
            ? "Enviando solicitud"
            : "Quiero que revisen mi plan"}
        </button>
        <p
          id="request-access-status"
          role="status"
          aria-live="polite"
          className="landing-pretty mt-3 min-h-6 text-sm font-semibold leading-6 text-[#0b1738]"
        >
          {message}
        </p>
      </div>
    </div>
  );
}

export function PlanPromo({
  promo,
  regularMonthlyPriceLabel,
}: Readonly<{
  promo: AccessPlanPromoMetadata | undefined;
  regularMonthlyPriceLabel?: string;
}>) {
  if (!promo) return null;

  const details = [
    promo.discountedPriceCents
      ? `Precio inicial: ${formatArgentinePesoCents(promo.discountedPriceCents)}/mes`
      : null,
    promo.durationMonths ? `durante ${promo.durationMonths} meses` : null,
  ].filter(Boolean);

  return (
    <section
      className="landing-pretty border border-[#0355e8]/25 bg-[#0355e8] p-3 text-sm leading-6 text-white shadow-lg shadow-[#0355e8]/15"
      aria-label="Promoción disponible"
    >
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/75">
        Promo primeros 3 meses
      </p>
      <p className="mt-1 text-xl font-semibold tracking-[-0.04em]">
        {promo.label}
      </p>
      {details.length > 0 ? (
        <p className="mt-1 text-white/85">{details.join(" · ")}</p>
      ) : null}
      {regularMonthlyPriceLabel ? (
        <p className="mt-1 text-white/85">Luego {regularMonthlyPriceLabel}</p>
      ) : null}
      {promo.note ? <p className="mt-1 text-white/75">{promo.note}</p> : null}
    </section>
  );
}

function getPromoPriceLabel(promo: AccessPlanPromoMetadata | undefined) {
  if (!promo?.discountedPriceCents) return undefined;

  return `${formatArgentinePesoCents(promo.discountedPriceCents)}/mes`;
}

function formatArgentinePesoCents(value: number) {
  return `ARS ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value / 100)}`;
}

function Field({
  id,
  label,
  type = "text",
  autoComplete,
}: Readonly<{
  id: string;
  label: string;
  type?: string;
  autoComplete: string;
}>) {
  return (
    <label
      className="grid min-w-0 gap-2 text-sm font-semibold text-[#0b1738]"
      htmlFor={id}
    >
      {label}
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        required
        className="landing-focus min-h-12 w-full min-w-0 border border-[#0b1738]/20 px-3 text-base font-medium text-[#0b1738] outline-none transition-colors duration-200 hover:border-[#0355e8]/60"
      />
    </label>
  );
}

function NumberField({
  id,
  label,
  help,
  value,
  onChange,
  onBlur,
}: Readonly<{
  id: keyof AccessPlanRecommendationInput;
  label: string;
  help: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}>) {
  const helpId = `${id}-help`;

  return (
    <div className="grid min-w-0 gap-2 border border-[#0b1738]/10 bg-white p-3 shadow-sm shadow-[#0355e8]/5 sm:p-4">
      <label
        className="text-sm font-semibold leading-5 text-[#0b1738]"
        htmlFor={id}
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        required
        value={value}
        aria-describedby={helpId}
        onChange={(event) => onChange(event.currentTarget.value)}
        onBlur={onBlur}
        className="landing-focus min-h-11 w-full min-w-0 border border-[#0b1738]/20 px-3 text-base font-semibold text-[#0b1738] outline-none transition-colors duration-200 hover:border-[#0355e8]/60"
      />
      <p
        id={helpId}
        className="landing-pretty text-xs leading-5 text-[#0b1738]/65"
      >
        {help}
      </p>
    </div>
  );
}

function toNumericInputState(
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
