import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FinalCta,
  LandingHero,
  ProcessSection,
  ProofSection,
  PublicHeader,
  type LandingCta,
} from "./public-landing";

const loginCta: LandingCta = {
  href: "/auth/login",
  label: "Solicitar acceso",
};

const dashboardCta: LandingCta = {
  href: "/dashboard",
  label: "Ir al panel",
  note: "Sesión activa: continuá con tu operación.",
};

describe("public landing components", () => {
  it("renders a reserved wordmark slot and navigation links in the public header", () => {
    const html = renderToStaticMarkup(<PublicHeader cta={loginCta} />);

    expect(html).toContain("AdPropIA");
    expect(html).toContain("Gestión inmobiliaria");
    expect(html).not.toContain("Marca reservada");
    expect(html).toContain("Saltar al contenido principal");
    expect(html).not.toContain("Por GU Solutions");
    expect(html).toContain("href=\"#proceso\"");
    expect(html).toContain("href=\"/auth/login\"");
    expect(html).toContain("Solicitar acceso");
  });

  it("renders hero copy with the CTA supplied by the server view model", () => {
    const anonymousHtml = renderToStaticMarkup(<LandingHero cta={loginCta} />);
    const authenticatedHtml = renderToStaticMarkup(<LandingHero cta={dashboardCta} />);

    expect(anonymousHtml).toContain("Control inmobiliario para operar cartera, contratos y caja");
    expect(anonymousHtml).toContain("Plano operativo");
    expect(anonymousHtml).not.toMatch(/<[^>]*aria-hidden="true"[^>]*>Plano operativo/);
    expect(anonymousHtml).toContain("Señales de operación");
    expect(anonymousHtml).not.toMatch(/MVP|roadmap/i);
    expect(anonymousHtml).toContain("href=\"/auth/login\"");
    expect(authenticatedHtml).toContain("href=\"/dashboard\"");
    expect(authenticatedHtml).toContain("Sesión activa: continuá con tu operación.");
  });

  it("renders proof, process, and final CTA sections with sequential headings", () => {
    const html = renderToStaticMarkup(
      <>
        <ProofSection />
        <ProcessSection />
        <FinalCta cta={dashboardCta} />
      </>,
    );

    expect(html).toContain("<h2");
    expect(html).toContain("Del dato disperso al control operativo");
    expect(html).toContain("Una secuencia sobria para tomar control");
    expect(html).toContain("Ordená la operación antes de escalarla");
    expect(html).toContain("Decisiones con rastro");
    expect(html).toContain("Control sin teatro visual");
    expect(html).toContain("scroll-mt-24");
    expect(html).toContain("Desarrollado por GU Solutions");
    expect(html).toMatch(/<footer[\s\S]*Ordená la operación antes de escalarla[\s\S]*Desarrollado por GU Solutions/);
    expect(html).not.toMatch(/MVP|roadmap/i);
    expect(html).toContain("href=\"/dashboard\"");
  });
});
