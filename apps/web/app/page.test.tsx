import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/auth0", () => ({
  auth0: {
    getSession: mocks.getSession,
  },
}));

import LandingPage from "./page";
import RootLayout, { metadata } from "./layout";

async function renderHome() {
  const element = (await LandingPage()) as ReactElement;
  return renderToStaticMarkup(element);
}

describe("LandingPage", () => {
  beforeEach(() => {
    mocks.getSession.mockReset();
  });

  it("renders the public landing with an anonymous login CTA", async () => {
    mocks.getSession.mockResolvedValue(null);

    const html = await renderHome();

    expect(mocks.getSession).toHaveBeenCalledTimes(1);
    expect(html).toContain("Control inmobiliario para operar cartera, contratos y caja");
    expect(html).toContain("Señales de operación");
    expect(html).toContain("Desarrollado por GU Solutions");
    expect(html).not.toContain("Por GU Solutions");
    expect(html).not.toMatch(/MVP|roadmap/i);
    expect(html).toContain("href=\"/auth/login\"");
    expect(html).toContain("Solicitar acceso");
    expect(html).not.toContain("Espacio de trabajo con aislamiento por cliente");
  });

  it("renders the public landing with an authenticated dashboard CTA", async () => {
    mocks.getSession.mockResolvedValue({ user: { name: "Ada Lovelace" } });

    const html = await renderHome();

    expect(html).toContain("href=\"/dashboard\"");
    expect(html).toContain("Ir al panel");
    expect(html).toContain("Ada Lovelace, ya tenés una sesión activa.");
    expect(html).not.toContain("href=\"/auth/login\"");
  });

  it("uses semantic landmarks, one h1, and ordered section headings", async () => {
    mocks.getSession.mockResolvedValue(null);

    const html = await renderHome();

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
