import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RequestAccessPage from "./page";

describe("RequestAccessPage", () => {
  it("renders the public assisted intake page", () => {
    const html = renderToStaticMarkup(<RequestAccessPage />);

    expect(html).toContain("Pedí acceso con una referencia clara de plan y precio");
    expect(html).toContain("Promo: 20% menos los primeros 3 meses");
    expect(html).toContain("Cotizador en vivo");
    expect(html).toContain("Cotización en vivo");
    expect(html).toContain("sin crear accesos automáticamente");
  });
});
