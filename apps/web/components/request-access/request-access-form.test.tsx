import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  normalizeAccessPlanInput,
  normalizeNumericDraft,
  PlanPromo,
  RequestAccessForm,
  sanitizeNumericDraft
} from "./request-access-form";

describe("RequestAccessForm", () => {
  it("renders all required intake fields and the Turnstile placeholder", () => {
    const html = renderToStaticMarkup(<RequestAccessForm turnstileSiteKey="site-key" />);

    expect(html).toContain("Inmobiliaria");
    expect(html).not.toContain("Empresa");
    expect(html).toContain("Nombre de contacto");
    expect(html).toContain("Email");
    expect(html).toContain("WhatsApp o teléfono");
    expect(html).toContain("Alquileres / administración");
    expect(html).toContain("Unidades en venta");
    expect(html).toContain("Usuarios");
    expect(html).toContain("Cotización en vivo");
    expect(html).toContain("Contexto opcional");
    expect(html).toContain("Prioridades o dudas principales");
    expect(html).toContain("data-sitekey=\"site-key\"");
  });

  it("does not present modules as pricing checkboxes", () => {
    const html = renderToStaticMarkup(<RequestAccessForm turnstileSiteKey="site-key" />);

    expect(html).not.toContain("name=\"selectedModules\"");
    expect(html).not.toContain("type=\"checkbox\"");
    expect(html).not.toContain("Gestión de unidades en venta");
    expect(html).toContain("No es un selector de módulos ni modifica la cotización.");
  });

  it("shows a non-binding recommendation before submission with sale units kept separate", () => {
    const html = renderToStaticMarkup(
      <RequestAccessForm
        turnstileSiteKey="site-key"
        initialValues={{ rentalAdministrationUnits: 180, saleUnits: 900, users: 5 }}
      />
    );

    expect(html).toContain("Profesional");
    expect(html).toContain("Por 180 unidades de alquiler/administración y 5 usuarios.");
    expect(html).not.toContain("Referencia, no recibo");
    expect(html).toContain("Mensual");
    expect(html).toContain("ARS 95.200/mes");
    expect(html).toContain("Primeros 3 meses. Luego ARS 119.000/mes.");
    expect(html).toContain("ARS 119.000/mes");
    expect(html).toContain("Anual");
    expect(html).toContain("ARS 101.150/mes equiv.");
    expect(html).toContain("Total anual ARS 1.213.800.");
    expect(html).toContain("15% menos, precio congelado 12 meses y no acumulable con la promo mensual.");
    expect(html).toContain("Tu operación entra en este tramo por 180 unidades de alquiler/administración y 5 usuarios.");
    expect(html).toContain("Si superás 200 unidades o 5 usuarios, pasás al siguiente plan.");
    expect(html).toContain("900 unidades en venta quedan registradas aparte: no suben el plan recomendado.");
    expect(html).toContain("Hasta 200 unidades en alquiler/administración.");
    expect(html).toContain("Liquidaciones, reportes y automatismos para bajar tareas repetidas.");
    expect(html).toContain("incluidas sin cargo durante 6 meses");
    expect(html).toContain("Quiero que revisen mi plan");
  });

  it("hides the sale units note when sale units are zero", () => {
    const html = renderToStaticMarkup(<RequestAccessForm turnstileSiteKey="site-key" />);

    expect(html).not.toContain(
      "0 unidades en venta quedan registradas aparte: no suben el plan recomendado."
    );
  });

  it("renders plan inclusions as visible benefits instead of a hidden details block", () => {
    const html = renderToStaticMarkup(<RequestAccessForm turnstileSiteKey="site-key" />);

    expect(html).toContain("Incluye");
    expect(html).toContain("Beneficios incluidos en el plan recomendado");
    expect(html).not.toContain("<details");
    expect(html).not.toContain("Ver qué incluye este plan");
  });

  it("keeps numeric drafts editable and normalizes only committed values", () => {
    expect(sanitizeNumericDraft("003 usuarios")).toBe("003");
    expect(sanitizeNumericDraft("")).toBe("");
    expect(normalizeNumericDraft("", 1)).toBe(1);
    expect(normalizeNumericDraft("0003", 1)).toBe(3);
    expect(normalizeAccessPlanInput({ rentalAdministrationUnits: "", saleUnits: "0007", users: "0" })).toEqual({
      rentalAdministrationUnits: 0,
      saleUnits: 7,
      users: 1
    });
  });

  it("explains A medida without rendering fixed promo or fake annual pricing", () => {
    const html = renderToStaticMarkup(
      <RequestAccessForm
        turnstileSiteKey="site-key"
        initialValues={{ rentalAdministrationUnits: 501, saleUnits: 12, users: 10 }}
      />
    );

    expect(html).toContain("A medida");
    expect(html).toContain("Consultar");
    expect(html).toContain("Condiciones anuales a revisar con el equipo.");
    expect(html).toContain("Tu operación necesita revisión porque supera los tramos públicos");
    expect(html).not.toContain("Primeros 3 meses. Luego");
    expect(html).not.toContain("20% menos los primeros 3 meses");
    expect(html).not.toContain("/mes equiv.");
    expect(html).not.toContain("Total anual ARS");
  });

  it("hides the promo block when no promo is provided", () => {
    const html = renderToStaticMarkup(<PlanPromo promo={undefined} />);

    expect(html).toBe("");
  });

  it("renders a promo block only when pricing metadata provides one", () => {
    const html = renderToStaticMarkup(
      <PlanPromo
        regularMonthlyPriceLabel="ARS 119.000/mes"
        promo={{
          label: "20% menos los primeros 3 meses",
          durationMonths: 3,
          discountedPriceCents: 95_200_00,
          percentOff: 20,
          note: "La aplicaríamos sólo si sigue vigente al confirmar el alta."
        }}
      />
    );

    expect(html).toContain("Promoción disponible");
    expect(html).toContain("Promo primeros 3 meses");
    expect(html).toContain("20% menos los primeros 3 meses");
    expect(html).toContain("Precio inicial: ARS 95.200/mes");
    expect(html).toContain("Luego ARS 119.000/mes");
    expect(html).toContain("durante 3 meses");
    expect(html).toContain("sigue vigente al confirmar el alta");
  });
});
