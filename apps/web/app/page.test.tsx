import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

import LandingPage from "./page";
import RootLayout, { metadata } from "./layout";

function renderHome() {
  const element = LandingPage() as ReactElement;
  return renderToStaticMarkup(element);
}

describe("LandingPage", () => {
  it("renders the public landing with a request-access CTA", () => {
    const html = renderHome();

    expect(html).toContain("Control inmobiliario para operar cartera, contratos y caja");
    expect(html).toContain("Automatismos operativos para detectar próximas actualizaciones");
    expect(html).toContain("preparar ajustes por IPC, ICL, UVA o reglas propias");
    expect(html).toContain("Índices y ajustes");
    expect(html).toContain("IPC, ICL, UVA y esquemas fijos, manuales o personalizados");
    expect(html).toContain("Desarrollado por GU Solutions");
    expect(html).not.toContain("Por GU Solutions");
    expect(html).not.toMatch(/MVP|roadmap/i);
    expect(html).toContain("href=\"/request-access\"");
    expect(html).toContain("href=\"/auth/login\"");
    expect(html).toContain("Solicitar acceso");
    expect(html).toContain("Ingresar al panel");
    expect(html).not.toContain("Espacio de trabajo con aislamiento por cliente");
  });

  it("uses semantic landmarks, one h1, and ordered section headings", () => {
    const html = renderHome();

    expect(html).toContain("<header");
    expect(html).toContain("<main id=\"contenido\"");
    expect(html).toContain("<section");
    expect(html).toContain("<footer");
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toMatch(/<h1[^>]*>Control inmobiliario para operar cartera, contratos y caja<\/h1>/);
    expect(html).toMatch(/<h2[^>]*>Del dato disperso al control operativo<\/h2>[\s\S]*<h2[^>]*>Una secuencia sobria para tomar control<\/h2>[\s\S]*<h2[^>]*>Ordená la operación antes de escalarla<\/h2>/);
    expect(html).toMatch(/<footer[\s\S]*Desarrollado por GU Solutions[\s\S]*<\/footer>/);
  });

  it("exports Spanish SEO metadata and an indexable root layout", () => {
    const layoutHtml = renderToStaticMarkup(
      <RootLayout>
        <main>Contenido</main>
      </RootLayout>,
    );

    expect(metadata.title).toEqual("AdPropIA | Gestión inmobiliaria con control");
    expect(metadata.description).toEqual(
      "Centralizá propiedades, contratos, pagos y auditoría en una plataforma inmobiliaria multi-cliente.",
    );
    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(layoutHtml).toContain("lang=\"es-AR\"");
    expect(JSON.stringify(metadata).toLowerCase()).not.toContain("noindex");
  });
});
