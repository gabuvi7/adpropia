import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RequestAccessForm } from "./request-access-form";

describe("RequestAccessForm", () => {
  it("renders all required intake fields and the Turnstile placeholder", () => {
    const html = renderToStaticMarkup(<RequestAccessForm turnstileSiteKey="site-key" />);

    expect(html).toContain("Empresa");
    expect(html).toContain("Nombre de contacto");
    expect(html).toContain("Email");
    expect(html).toContain("WhatsApp o teléfono");
    expect(html).toContain("Unidades en alquiler/administración");
    expect(html).toContain("Unidades en venta");
    expect(html).toContain("Usuarios");
    expect(html).toContain("Gestión de unidades en venta");
    expect(html).toContain("data-sitekey=\"site-key\"");
  });

  it("shows a non-binding recommendation before submission with sale units kept separate", () => {
    const html = renderToStaticMarkup(
      <RequestAccessForm
        turnstileSiteKey="site-key"
        initialValues={{ rentalAdministrationUnits: 180, saleUnits: 900, users: 5 }}
      />
    );

    expect(html).toContain("Plan recomendado");
    expect(html).toContain("Profesional");
    expect(html).toContain("900 unidades");
    expect(html).toContain("incluidas sin cargo durante 6 meses");
    expect(html).toContain("sujeta a revisión comercial");
  });
});
