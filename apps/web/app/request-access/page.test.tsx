import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RequestAccessPage from "./page";

describe("RequestAccessPage", () => {
  it("renders the public assisted intake page", () => {
    const html = renderToStaticMarkup(<RequestAccessPage />);

    expect(html).toContain("Pedí acceso con una referencia clara de plan y precio");
    expect(html).toContain("Referencia inicial");
    expect(html).toContain("menos los primeros 3 meses en planes con precio mensual fijo");
    expect(html).toContain("Cotizador en vivo");
    expect(html).toContain("Cotización en vivo");
    expect(html).toContain("sin crear accesos automáticamente");
    expect(html).toContain("href=\"/pricing\"");
    expect(html).toContain("Ver página de precios");
    expect(html).toContain("El plan recomendado se calcula con unidades administradas y usuarios");
  });
});
