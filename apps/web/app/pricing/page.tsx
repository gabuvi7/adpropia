import type { Metadata } from "next";

import { PublicPricing } from "@/components/pricing/public-pricing";
import { PUBLIC_PRICING_NAV_ITEMS, PublicSiteHeader, PublicSiteNav } from "@/components/public-site-header";

export const metadata: Metadata = {
  title: "Precios | AdPropIA",
  description:
    "Planes y adicionales de AdPropIA para administraciones inmobiliarias: mensual, anual, venta y WhatsApp operativo.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "Precios claros para operar mejor | AdPropIA",
    description: "Planes públicos, descuentos no acumulables y adicionales operativos para gestión inmobiliaria.",
    type: "website",
    locale: "es_AR",
    images: [
      {
        url: "/pricing/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Precios de AdPropIA para administración inmobiliaria",
      },
    ],
  },
};

export default function PricingPage() {
  return (
    <>
      <PublicSiteHeader eyebrow="Precios">
        <PublicSiteNav
          ariaLabel="Navegación de precios"
          items={PUBLIC_PRICING_NAV_ITEMS}
        />
      </PublicSiteHeader>
      <main id="contenido" tabIndex={-1} className="min-h-screen scroll-mt-24 bg-white text-[#0b1738]">
        <PublicPricing />
      </main>
    </>
  );
}
