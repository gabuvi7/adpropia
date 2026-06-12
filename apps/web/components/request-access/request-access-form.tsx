"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  accessRequestModules,
  recommendAccessPlan,
  type AccessPlanRecommendationInput,
  type AccessRequestInput,
  type AccessRequestModule
} from "@adpropia/shared";

type FormState = "idle" | "submitting" | "success" | "error";

export type RequestAccessFormProps = Readonly<{
  turnstileSiteKey: string;
  initialValues?: Partial<AccessPlanRecommendationInput>;
}>;

const defaultValues: AccessPlanRecommendationInput = {
  rentalAdministrationUnits: 50,
  saleUnits: 0,
  users: 2
};

const moduleDescriptions: Record<AccessRequestModule, string> = {
  RENTALS_AND_CONTRACTS: "Contratos, cartera y condiciones de alquiler.",
  INDEXES_AND_ADJUSTMENTS: "IPC, ICL, UVA y reglas propias con revisión.",
  COLLECTIONS_PAYMENTS_CASH: "Seguimiento de cobros, pagos y movimientos.",
  OWNER_LIQUIDATIONS: "Liquidaciones trazables para propietarios.",
  REPORTS_AND_AUDIT: "Lecturas operativas y evidencia para revisar.",
  SALE_UNIT_MANAGEMENT: "Captura comercial sin afectar el plan inicial.",
  AUTOMATIONS_AND_REMINDERS: "Alertas para vencimientos y tareas recurrentes."
};

export function RequestAccessForm({ turnstileSiteKey, initialValues }: RequestAccessFormProps) {
  const [units, setUnits] = useState({ ...defaultValues, ...initialValues });
  const [status, setStatus] = useState<FormState>("idle");
  const [message, setMessage] = useState<string>("");

  const recommendation = useMemo(() => recommendAccessPlan(units), [units]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const selectedModules = formData.getAll("selectedModules").map(String) as AccessRequestModule[];
    const payload: AccessRequestInput = {
      companyName: String(formData.get("companyName") ?? ""),
      contactName: String(formData.get("contactName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      rentalAdministrationUnits: units.rentalAdministrationUnits,
      saleUnits: units.saleUnits,
      users: units.users,
      selectedModules,
      turnstileToken: String(formData.get("cf-turnstile-response") ?? formData.get("turnstileToken") ?? "")
    };

    const response = await fetch("/api/access-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      setStatus("error");
      setMessage("No pudimos enviar la solicitud. Revisá los datos y la verificación anti-spam.");
      return;
    }

    setStatus("success");
    setMessage("Recibimos tu solicitud. El equipo revisará el plan recomendado y te contactará.");
  }

  return (
    <form action="/api/access-requests" method="POST" onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start" aria-describedby="request-access-status request-access-note">
      <div className="grid gap-6">
        <fieldset className="grid gap-5 border border-[#0b1738]/12 bg-white p-5 shadow-xl shadow-[#0355e8]/5 sm:p-6">
          <legend className="-ml-1 px-1 text-sm font-semibold uppercase tracking-[0.24em] text-[#0355e8]">Datos de contacto</legend>
          <p className="landing-pretty text-sm leading-6 text-[#0b1738]/70">Dejanos los datos de la empresa y una vía directa para coordinar la revisión comercial.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="companyName" label="Empresa" autoComplete="organization" />
            <Field id="contactName" label="Nombre de contacto" autoComplete="name" />
            <Field id="email" label="Email" type="email" autoComplete="email" />
            <Field id="phone" label="WhatsApp o teléfono" type="tel" autoComplete="tel" />
          </div>
        </fieldset>

        <fieldset className="grid gap-5 border border-[#0b1738]/12 bg-white p-5 shadow-xl shadow-[#0355e8]/5 sm:p-6">
          <legend className="-ml-1 px-1 text-sm font-semibold uppercase tracking-[0.24em] text-[#0355e8]">Tamaño de la operación</legend>
          <p className="landing-pretty text-sm leading-6 text-[#0b1738]/70">La recomendación se calcula con unidades en alquiler/administración y usuarios. Las unidades en venta se registran aparte.</p>
          <div className="grid gap-4 md:grid-cols-3 md:items-start">
            <NumberField id="rentalAdministrationUnits" label="Unidades en alquiler/administración" help="Este volumen define el tramo principal del plan." value={units.rentalAdministrationUnits} onChange={(value) => setUnits((current) => ({ ...current, rentalAdministrationUnits: value }))} />
            <NumberField id="saleUnits" label="Unidades en venta" help="Incluidas sin cargo durante 6 meses; no suben el plan recomendado." value={units.saleUnits} onChange={(value) => setUnits((current) => ({ ...current, saleUnits: value }))} />
            <NumberField id="users" label="Usuarios" help="Cantidad de personas que operan la plataforma." min={1} value={units.users} onChange={(value) => setUnits((current) => ({ ...current, users: value }))} />
          </div>
        </fieldset>

        <fieldset className="grid gap-5 border border-[#0b1738]/12 bg-white p-5 shadow-xl shadow-[#0355e8]/5 sm:p-6">
          <legend className="-ml-1 px-1 text-sm font-semibold uppercase tracking-[0.24em] text-[#0355e8]">Módulos y necesidades</legend>
          <p className="landing-pretty text-sm leading-6 text-[#0b1738]/70">Marcá las áreas que querés activar o revisar en la primera conversación.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {accessRequestModules.map((module) => (
              <label key={module.value} className="landing-focus group grid min-h-24 cursor-pointer grid-cols-[auto_1fr] gap-3 border border-[#0b1738]/15 bg-white p-4 transition-colors duration-200 hover:border-[#0355e8]/60 hover:bg-[#1472fa]/5 has-[:checked]:border-[#0355e8] has-[:checked]:bg-[#1472fa]/10">
                <input className="mt-1 size-5 accent-[#0355e8]" type="checkbox" name="selectedModules" value={module.value} defaultChecked={module.value === "RENTALS_AND_CONTRACTS"} />
                <span>
                  <span className="block text-sm font-semibold text-[#0b1738]">{module.label}</span>
                  <span className="landing-pretty mt-2 block text-sm leading-6 text-[#0b1738]/65">{moduleDescriptions[module.value]}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <aside className="lg:sticky lg:top-6">
        <section aria-labelledby="recommendation-title" className="border border-[#0b1738]/12 bg-white p-5 text-[#0b1738] shadow-2xl shadow-[#0355e8]/15 sm:p-6">
          <p id="recommendation-title" className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0355e8]">Plan recomendado</p>
          <p className="mt-4 text-4xl font-semibold tracking-[-0.055em]">{recommendation.label}</p>
          <p className="landing-pretty mt-4 leading-7 text-[#0b1738]/75">{recommendation.message}</p>

          <dl className="mt-6 grid gap-0 border-y border-[#0b1738]/10">
            <SummaryItem label="Alquiler/administración" value={`${recommendation.rentalAdministrationUnits} unidades`} />
            <SummaryItem label="Usuarios" value={`${recommendation.users} usuarios`} />
            <SummaryItem label="Venta" value={`${recommendation.saleUnitsCapturedSeparately} unidades`} />
          </dl>

          <p id="request-access-note" className="landing-pretty mt-5 border-l-4 border-[#0355e8] bg-[#1472fa]/10 px-4 py-3 text-sm font-semibold leading-6 text-[#0b1738]">
            Las unidades en venta quedan registradas aparte e incluidas sin cargo durante 6 meses. La confirmación final no es vinculante y queda sujeta a revisión comercial.
          </p>

          <div className="mt-6 grid gap-3">
            <input type="hidden" name="turnstileToken" />
            <div className="cf-turnstile min-h-16 border border-dashed border-[#0b1738]/25 bg-[#0b1738]/5 p-4 text-sm text-[#0b1738]/60" data-sitekey={turnstileSiteKey} aria-label="Verificación anti-spam de Cloudflare Turnstile" />
          </div>

          <button type="submit" disabled={status === "submitting"} className="landing-focus mt-5 min-h-12 w-full bg-[#0355e8] px-6 text-sm font-semibold text-white shadow-lg shadow-[#0355e8]/20 transition-colors duration-200 hover:bg-[#1472fa] disabled:cursor-wait disabled:opacity-70">
            {status === "submitting" ? "Enviando solicitud" : "Enviar solicitud de activación"}
          </button>
          <p id="request-access-status" role="status" aria-live="polite" className="landing-pretty mt-4 min-h-6 text-sm font-semibold leading-6 text-[#0b1738]">
            {message}
          </p>
        </section>
      </aside>
    </form>
  );
}

function Field({ id, label, type = "text", autoComplete }: Readonly<{ id: string; label: string; type?: string; autoComplete: string }>) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[#0b1738]" htmlFor={id}>
      {label}
      <input id={id} name={id} type={type} autoComplete={autoComplete} required className="landing-focus min-h-12 border border-[#0b1738]/20 px-3 text-base font-medium text-[#0b1738] outline-none transition-colors duration-200 hover:border-[#0355e8]/50" />
    </label>
  );
}

function NumberField({ id, label, help, value, min = 0, onChange }: Readonly<{ id: keyof AccessPlanRecommendationInput; label: string; help: string; value: number; min?: number; onChange: (value: number) => void }>) {
  const helpId = `${id}-help`;

  function handleNumericChange(rawValue: string) {
    const digitsOnly = rawValue.replace(/\D/g, "");
    const parsedValue = digitsOnly === "" ? min : Number(digitsOnly);
    onChange(Math.max(min, parsedValue));
  }

  return (
    <div className="grid h-full grid-rows-[2.5rem_auto_1fr] gap-2">
      <label className="flex items-end text-sm font-semibold leading-5 text-[#0b1738]" htmlFor={id}>{label}</label>
      <input id={id} name={id} type="text" inputMode="numeric" pattern="[0-9]*" required value={String(value)} aria-describedby={helpId} onChange={(event) => handleNumericChange(event.currentTarget.value)} className="landing-focus min-h-12 border border-[#0b1738]/20 px-3 text-base font-semibold text-[#0b1738] outline-none transition-colors duration-200 hover:border-[#0355e8]/50" />
      <p id={helpId} className="landing-pretty text-sm leading-6 text-[#0b1738]/65">{help}</p>
    </div>
  );
}

function SummaryItem({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="grid gap-1 border-b border-[#0b1738]/10 py-4 last:border-b-0">
      <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0355e8]">{label}</dt>
      <dd className="text-base font-semibold text-[#0b1738]">{value}</dd>
    </div>
  );
}
