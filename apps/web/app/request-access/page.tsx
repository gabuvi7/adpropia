import Script from "next/script";
import Link from "next/link";
import { PublicSiteHeader } from "@/components/public-site-header";
import { RequestAccessForm } from "@/components/request-access/request-access-form";

const activationSteps = ["Dimensioná tu operación", "Revisá el plan sugerido", "Coordiná la activación"] as const;

export default function RequestAccessPage() {
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      <PublicSiteHeader eyebrow="Cotizador asistido">
        <Link className="landing-focus inline-flex min-h-11 items-center text-sm font-semibold text-[#0355e8] transition-colors duration-200 hover:text-[#1472fa]" href="/auth/login">
          Ingresar al panel
        </Link>
      </PublicSiteHeader>
      <main id="contenido" tabIndex={-1} className="min-h-screen scroll-mt-24 bg-white text-[#0b1738]">
        <section aria-labelledby="request-access-title" className="overflow-hidden border-b border-[#0b1738]/10 bg-[#0b1738] px-6 py-10 text-white md:py-14">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_24rem] lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[#b8dcff]">cotizador asistido comercial</p>
              <h1 id="request-access-title" className="landing-balance mt-4 max-w-4xl text-5xl font-semibold leading-[0.95] tracking-[-0.075em] sm:text-6xl">
                Encontrá el plan correcto para tu operación
              </h1>
              <p className="landing-pretty mt-5 max-w-2xl text-lg leading-8 text-white/80">
                Contanos el tamaño de tu cartera, los módulos que necesitás y revisá una recomendación antes de enviar la solicitud. La activación queda asistida por el equipo comercial y este flujo no crea aprovisionamiento automático.
              </p>
            </div>
            <ol className="grid gap-0 border-y border-white/20 bg-white/5 sm:grid-cols-3 lg:grid-cols-1">
              {activationSteps.map((step, index) => (
                <li key={step} className="border-b border-white/20 p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 lg:border-b lg:border-r-0">
                  <span className="text-xs font-bold uppercase tracking-[0.22em] text-[#b8dcff]">0{index + 1}</span>
                  <p className="mt-2 text-sm font-semibold leading-6 text-white">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section className="px-6 py-10 md:py-14" aria-label="Solicitud de activación">
          <div className="mx-auto max-w-6xl">
            <RequestAccessForm turnstileSiteKey={turnstileSiteKey} />
          </div>
        </section>
      </main>
    </>
  );
}
