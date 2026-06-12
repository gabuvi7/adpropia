import Script from "next/script";
import Link from "next/link";
import { PublicSiteHeader } from "@/components/public-site-header";
import { RequestAccessForm } from "@/components/request-access/request-access-form";

export default function RequestAccessPage() {
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        async
        defer
      />
      <PublicSiteHeader eyebrow="Cotizador">
        <Link
          className="landing-focus inline-flex min-h-11 items-center text-sm font-semibold text-[#0355e8] transition-colors duration-200 hover:text-[#1472fa]"
          href="/auth/login"
        >
          Ingresar al panel
        </Link>
      </PublicSiteHeader>
      <main
        id="contenido"
        tabIndex={-1}
        className="min-h-screen scroll-mt-24 bg-white text-[#0b1738]"
      >
        <section
          aria-labelledby="request-access-title"
          className="overflow-hidden border-b border-[#0b1738]/10 bg-[linear-gradient(135deg,#ffffff_0%,#eef6ff_52%,#ffffff_100%)] px-6 py-8 md:py-10"
        >
          <div className="mx-auto max-w-6xl">
            <p className="inline-flex min-h-9 items-center border border-[#0355e8]/20 bg-white px-4 text-sm font-semibold text-[#0355e8] shadow-sm shadow-[#0355e8]/10">
              Promo: 20% menos los primeros 3 meses
            </p>
            <h1
              id="request-access-title"
              className="landing-balance mt-4 max-w-4xl text-4xl font-semibold leading-[0.98] tracking-[-0.065em] text-[#0b1738] sm:text-6xl"
            >
              Pedí acceso con una referencia clara de plan y precio
            </h1>
            <p className="landing-pretty mt-4 max-w-2xl text-lg leading-8 text-[#0b1738]/75">
              Cargá tu volumen operativo, mirá la recomendación en vivo y enviá
              la solicitud.
            </p>
          </div>
        </section>
        <section
          className="px-6 py-8 md:py-10"
          aria-label="Cotizador y solicitud de acceso"
        >
          <div className="mx-auto max-w-6xl">
            <RequestAccessForm turnstileSiteKey={turnstileSiteKey} />
          </div>
        </section>
      </main>
    </>
  );
}
