import type { ReactNode } from "react";
import type { AccessPlanRecommendationInput } from "@adpropia/shared";
import type { ContactFieldId } from "./request-access-validation";

export function Fieldset({
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
    <fieldset className="grid min-w-0 gap-6 border-t border-[#0b1738]/10 bg-white pt-7 first:border-t-0 first:pt-0">
      <legend className="-ml-1 px-1">
        <span className="block text-xs font-bold uppercase tracking-[0.24em] text-[#0355e8]">
          {eyebrow}
        </span>
        <span className="mt-2 block text-3xl font-semibold tracking-[-0.055em] text-[#0b1738]">
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

export function ContextFields() {
  return (
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
        ventas. Lo usamos como contexto comercial y no modifica la cotización.
      </span>
    </label>
  );
}

export function Field({
  id,
  label,
  type = "text",
  autoComplete,
  error,
  onChange,
}: Readonly<{
  id: ContactFieldId;
  label: string;
  type?: string;
  autoComplete: string;
  error: string | undefined;
  onChange: () => void;
}>) {
  const errorId = `${id}-error`;
  const inputClassName = getInputClassName(error);

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
        aria-invalid={error ? true : undefined}
        aria-errormessage={error ? errorId : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={onChange}
        className={inputClassName}
      />
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </label>
  );
}

export function NumberField({
  id,
  label,
  help,
  value,
  error,
  onChange,
  onBlur,
}: Readonly<{
  id: keyof AccessPlanRecommendationInput;
  label: string;
  help: string;
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
  onBlur: () => void;
}>) {
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = error ? `${helpId} ${errorId}` : helpId;
  const inputClassName = getInputClassName(
    error,
    "font-semibold shadow-sm shadow-[#0355e8]/5",
  );

  return (
    <div className="grid min-w-0 gap-2">
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
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        aria-errormessage={error ? errorId : undefined}
        onChange={(event) => onChange(event.currentTarget.value)}
        onBlur={onBlur}
        className={inputClassName}
      />
      <p
        id={helpId}
        className="landing-pretty text-xs leading-5 text-[#0b1738]/65"
      >
        {help}
      </p>
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}

export function FieldError({
  id,
  children,
}: Readonly<{ id: string; children: ReactNode }>) {
  return (
    <p
      id={id}
      className="landing-pretty inline-flex items-start gap-2 text-sm font-semibold leading-6 text-[#b42318]"
    >
      <span
        aria-hidden="true"
        className="mt-[0.35rem] size-1.5 shrink-0 rounded-full bg-[#d92d20]"
      />
      <span>{children}</span>
    </p>
  );
}

function getInputClassName(
  error: string | undefined,
  extraClassName = "font-medium",
) {
  const stateClassName = error
    ? "border-[#d92d20] bg-[#fff7f6] shadow-[0_0_0_3px_rgba(217,45,32,0.08)] hover:border-[#b42318]"
    : "border-[#0b1738]/20 bg-white hover:border-[#0355e8]/60";

  return `landing-focus min-h-12 w-full min-w-0 border px-3 text-base text-[#0b1738] outline-none transition-colors duration-200 ${extraClassName} ${stateClassName}`;
}
