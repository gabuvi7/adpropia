import { FieldError } from "./request-access-fields";
import type { FormState } from "./request-access-validation";

export function RequestFooter({
  turnstileSiteKey,
  status,
  message,
  turnstileError,
}: Readonly<{
  turnstileSiteKey: string;
  status: FormState;
  message: string;
  turnstileError: string | undefined;
}>) {
  const turnstileErrorId = "turnstileToken-error";

  return (
    <div className="grid gap-5 border-t border-[#0b1738]/10 pt-6 lg:grid-cols-[1fr_20rem] lg:items-end">
      <div>
        <p
          id="request-access-note"
          className="landing-pretty border-l border-[#0355e8]/35 bg-[#f7fbff] px-4 py-3 text-sm font-semibold leading-6 text-[#0b1738]"
        >
          Antes de enviar, tomá el plan recomendado como referencia. Las
          unidades en venta quedan incluidas sin cargo durante 6 meses y después
          se revisan con el equipo.
        </p>
        <div className="mt-4 grid gap-3">
          <input type="hidden" name="turnstileToken" />
          <div
            className={`cf-turnstile min-h-16 border border-dashed bg-white p-4 text-sm text-[#0b1738]/60 ${
              turnstileError
                ? "border-[#d92d20] bg-[#fff7f6] shadow-[0_0_0_3px_rgba(217,45,32,0.08)]"
                : "border-[#0b1738]/20"
            }`}
            data-sitekey={turnstileSiteKey}
            role="group"
            aria-label="Verificación anti-spam de Cloudflare Turnstile"
            aria-invalid={turnstileError ? true : undefined}
            aria-errormessage={turnstileError ? turnstileErrorId : undefined}
            aria-describedby={turnstileError ? turnstileErrorId : undefined}
          />
          {turnstileError ? (
            <FieldError id={turnstileErrorId}>{turnstileError}</FieldError>
          ) : null}
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
