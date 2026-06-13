import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PublicPricing } from "./public-pricing";

function renderPricing() {
  return renderToStaticMarkup(<PublicPricing />);
}

describe("PublicPricing", () => {
  it("renders the required pricing sections and explicit fixed-plan promo prices", () => {
    const html = renderPricing();

    expect(html).toContain("Precios claros para ordenar tu operación inmobiliaria");
    expect(html).toContain("Planes mensuales");
    expect(html).toContain("Inicial");
    expect(html).toContain("ARS 39.200/mes");
    expect(html).toContain("Luego ARS 49.000/mes");
    expect(html).toContain("ARS 49.000/mes");
    expect(html).toContain("Profesional");
    expect(html).toContain("ARS 95.200/mes");
    expect(html).toContain("Luego ARS 119.000/mes");
    expect(html).toContain("ARS 119.000/mes");
    expect(html).toContain("Recomendado");
    expect(html).toContain("Operativo");
    expect(html).toContain("ARS 183.200/mes");
    expect(html).toContain("Luego ARS 229.000/mes");
    expect(html).toContain("ARS 229.000/mes");
    expect(html).toContain("A medida");
    expect(html).toContain("Consultar");
    expect(html).not.toContain("Luego Consultar");
    expect(html).toContain("Casa y primeras unidades");
    expect(html).toContain("Edificio en crecimiento");
    expect(html).toContain("Cartera operativa");
    expect(html).toContain("Operación extendida");
    expect(html).toContain("Comparativa breve");
    expect(html).toContain("Preguntas frecuentes");
    expect(html).toContain("href=\"/request-access\"");
  });

  it("renders plan cards with operational fit and scannable limits", () => {
    const html = renderPricing();

    expect(html).toContain("Para empezar con una base ordenada de alquileres, cobros, contratos e índices.");
    expect(html).toContain("Para equipos que coordinan más unidades, usuarios, liquidaciones e índices.");
    expect(html).toContain("Para operaciones con mayor volumen, ajustes por índices y seguimiento diario más exigente.");
    expect(html).toContain("Primeros 3 meses");
    expect(html).toContain("actualizaciones de índices preparadas");
    expect(html).toContain("actualizaciones por IPC, ICL, UVA o reglas propias");
    expect(html).toContain("actualizaciones automáticas");
    expect(html).toContain("Incluye");
    expect(html).toContain("Unidades");
    expect(html).toContain("Hasta 50");
    expect(html).toContain("Hasta 200");
    expect(html).toContain("Hasta 500");
    expect(html).toContain("Usuarios");
    expect(html).toContain("Hasta 2");
    expect(html).toContain("Hasta 5");
    expect(html).toContain("Hasta 10");
    expect(html).toContain("Más de 500");
  });

  it("renders monthly and annual discount rules without stacking discounts", () => {
    const html = renderPricing();

    expect(html).toContain("20% menos los primeros 3 meses");
    expect(html).toContain("sólo para planes con precio mensual fijo");
    expect(html).toContain("15% de descuento");
    expect(html).toContain("precio congelado por 12 meses");
    expect(html).toContain("Los descuentos no son acumulables");
  });

  it("renders add-ons as separate operational scope and avoids prohibited claims", () => {
    const html = renderPricing();

    expect(html).toContain("Adicionales separados");
    expect(html).toContain("Unidades en venta");
    expect(html).toContain("gratis los primeros 6 meses");
    expect(html).toContain("ARS 1.500/unidad");
    expect(html).toContain("Integración operativa por WhatsApp");
    expect(html).toContain("gratis los primeros 3 meses");
    expect(html).toContain("ARS 30.000/mes");
    expect(html).toContain("Recordatorios de vencimiento de alquiler");
    expect(html).toContain("Avisos de pago o mora");
    expect(html).toContain("Recordatorios de ajuste");
    expect(html).toContain("Avisos a propietarios y liquidaciones");
    expect(html).not.toMatch(/testimonios|social proof|multi-cliente|activaci[oó]n asistida|CRM|inbox/i);
  });
});
