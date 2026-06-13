import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PricingPage, { metadata } from "./page";
import OpenGraphImage, { alt, contentType, size } from "./opengraph-image";

describe("PricingPage", () => {
  it("exports Spanish SEO and OpenGraph metadata for the public pricing route", () => {
    expect(metadata.title).toEqual("Precios | AdPropIA");
    expect(metadata.description).toEqual(
      "Planes y adicionales de AdPropIA para administraciones inmobiliarias: mensual, anual, venta y WhatsApp operativo.",
    );
    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(metadata.openGraph).toMatchObject({
      title: "Precios claros para operar mejor | AdPropIA",
      description: "Planes públicos, descuentos no acumulables y adicionales operativos para gestión inmobiliaria.",
      type: "website",
      locale: "es_AR",
    });
  });

  it("renders the pricing page as static public content with a request-access CTA", () => {
    const html = renderToStaticMarkup(<PricingPage />);

    expect(html).toContain("<main id=\"contenido\"");
    expect(html).toContain("Precios claros para ordenar tu operación inmobiliaria");
    expect(html).toContain("href=\"/request-access\"");
    expect(html).toContain("Solicitar acceso");
    expect(html).toContain("ARS 49.000/mes");
    expect(html).toContain("ARS 119.000/mes");
    expect(html).toContain("ARS 229.000/mes");
    expect(html).not.toMatch(/testimonios|social proof|multi-cliente|activaci[oó]n asistida|CRM|inbox/i);
  });

  it("defines a branded OpenGraph image for pricing", () => {
    const response = OpenGraphImage();

    expect(alt).toEqual("Precios de AdPropIA para administración inmobiliaria");
    expect(contentType).toEqual("image/png");
    expect(size).toEqual({ width: 1200, height: 630 });
    expect(response).toBeInstanceOf(Response);
  });
});
