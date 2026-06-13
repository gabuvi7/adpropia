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

const accessCta: LandingCta = {
  href: "/request-access",
  label: "Solicitar acceso",
};

describe("public landing components", () => {
  it("renders a reserved wordmark slot and navigation links in the public header", () => {
    const html = renderToStaticMarkup(<PublicHeader />);

    expect(html).toContain("AdPropIA");
    expect(html).toContain("Gestión inmobiliaria");
    expect(html).not.toContain("Marca reservada");
    expect(html).toContain("Saltar al contenido principal");
    expect(html).not.toContain("Por GU Solutions");
    expect(html).toContain("href=\"#proceso\"");
    expect(html).toContain("href=\"/pricing\"");
    expect(html).toContain("Ver precios");
    expect(html).toContain("href=\"/auth/login\"");
    expect(html).toContain("Ingresar al panel");
    expect(html).not.toContain("Solicitar acceso");
  });

  it("renders hero copy with the CTA supplied by the server view model", () => {
    const anonymousHtml = renderToStaticMarkup(<LandingHero cta={accessCta} />);

    expect(anonymousHtml).toContain("Control inmobiliario para operar cartera, contratos y caja");
    expect(anonymousHtml).toContain("Plano operativo");
    expect(anonymousHtml).not.toMatch(/<[^>]*aria-hidden="true"[^>]*>Plano operativo/);
    expect(anonymousHtml).toContain("Automatismos operativos para detectar próximas actualizaciones");
    expect(anonymousHtml).toContain("preparar ajustes por IPC, ICL, UVA o reglas propias");
    expect(anonymousHtml).toContain("IPC, ICL, UVA y ajustes personalizados");
    expect(anonymousHtml).not.toMatch(/MVP|roadmap/i);
    expect(anonymousHtml).not.toMatch(/multi-cliente/i);
    expect(anonymousHtml).toContain("href=\"/request-access\"");
    expect(anonymousHtml).toContain("href=\"/pricing\"");
    expect(anonymousHtml).toContain("Ver planes y precios");
    expect(anonymousHtml).not.toContain("ARS 49.000/mes");
    expect(anonymousHtml).not.toContain("ARS 119.000/mes");
    expect(anonymousHtml).not.toContain("ARS 229.000/mes");
  });

  it("renders proof, process, and final CTA sections with sequential headings", () => {
    const html = renderToStaticMarkup(
      <>
        <ProofSection />
        <ProcessSection />
        <FinalCta cta={accessCta} />
      </>,
    );

    expect(html).toContain("<h2");
    expect(html).toContain("Del dato disperso al control operativo");
    expect(html).toContain("Índices y ajustes");
    expect(html).toContain("IPC, ICL, UVA y esquemas fijos, manuales o personalizados");
    expect(html).toContain("Registrá reglas de contrato: índice aplicable, período de ajuste, vigencia");
    expect(html).toContain("Usá automatismos para detectar próximas actualizaciones, preparar ajustes y priorizar qué revisar");
    expect(html).toContain("Confirmá el cambio con cálculo, fecha efectiva y evidencia trazable");
    expect(html).toContain("Una secuencia sobria para tomar control");
    expect(html).toContain("Ordená la operación antes de escalarla");
    expect(html).toContain("Decisiones con rastro");
    expect(html).toContain("Control sin teatro visual");
    expect(html).toContain("scroll-mt-24");
    expect(html).toContain("Desarrollado por GU Solutions");
    expect(html).toMatch(/<footer[\s\S]*Ordená la operación antes de escalarla[\s\S]*Desarrollado por GU Solutions/);
    expect(html).not.toMatch(/MVP|roadmap/i);
    expect(html).not.toMatch(/multi-cliente/i);
    expect(html).toContain("href=\"/request-access\"");
    expect(html).toContain("href=\"/pricing\"");
    expect(html).toContain("Comparar planes");
    expect(html).not.toContain("Más elegido");
    expect(html).not.toContain("Planes mensuales");
  });
});
