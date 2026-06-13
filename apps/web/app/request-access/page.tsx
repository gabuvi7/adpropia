import Script from "next/script";
import type { Route } from "next";
import Link from "next/link";
import { PUBLIC_REQUEST_ACCESS_NAV_ITEMS, PublicSiteHeader, PublicSiteNav } from "@/components/public-site-header";
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
        <PublicSiteNav
          ariaLabel="Navegación del cotizador"
          items={PUBLIC_REQUEST_ACCESS_NAV_ITEMS}
        />
      </PublicSiteHeader>
      <main
        id="contenido"
        tabIndex={-1}
        className="min-h-screen scroll-mt-24 bg-white text-[#0b1738]"
      >
        <section
          aria-labelledby="request-access-title"
          className="overflow-hidden bg-[linear-gradient(135deg,#ffffff_0%,#eef6ff_58%,#ffffff_100%)] px-6 py-16 md:py-20"
        >
          <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1fr_0.72fr] md:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#0355e8]">
                Cotizador
              </p>
              <h1
                id="request-access-title"
                className="landing-balance mt-5 max-w-4xl text-5xl font-semibold leading-[0.92] tracking-[-0.075em] text-[#0b1738] sm:text-7xl"
              >
                Pedí acceso con una referencia clara de plan y precio
              </h1>
              <p className="landing-pretty mt-7 max-w-2xl text-xl leading-8 text-[#0b1738]/78">
                Cargá tu volumen operativo, mirá una recomendación de plan y
                dejá tus datos para que revisemos la solicitud.
              </p>
              <Link
                className="landing-focus mt-8 inline-flex min-h-12 items-center border border-[#0355e8]/45 bg-white px-5 text-sm font-semibold text-[#0355e8] shadow-sm shadow-[#0355e8]/5 transition-colors duration-200 hover:border-[#0355e8] hover:bg-[#eef6ff]"
                href={"/pricing" as Route}
              >
                Ver página de precios
              </Link>
            </div>
            <aside
              aria-label="Resumen del cotizador"
              className="border border-[#0355e8]/16 bg-white/82 p-5 shadow-sm shadow-[#0355e8]/8"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#0355e8]">
                Referencia inicial
              </p>
              <dl className="mt-5 grid gap-4 text-[#0b1738] sm:grid-cols-2 md:grid-cols-1">
                <div className="border-l border-[#0355e8]/28 pl-4">
                  <dt className="text-2xl font-semibold tracking-[-0.05em]">
                    20%
                  </dt>
                  <dd className="mt-1 text-sm leading-6 text-[#0b1738]/72">
                    menos los primeros 3 meses en planes con precio mensual fijo.
                  </dd>
                </div>
                <div className="border-l border-[#0355e8]/28 pl-4">
                  <dt className="text-2xl font-semibold tracking-[-0.05em]">
                    Cotizador
                  </dt>
                  <dd className="mt-1 text-sm leading-6 text-[#0b1738]/72">
                    El plan recomendado se calcula con unidades administradas y
                    usuarios.
                  </dd>
                </div>
              </dl>
            </aside>
          </div>
        </section>
        <section
          className="px-6 py-16 md:py-20"
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
