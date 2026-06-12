import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RequestAccessPage from "./page";

describe("RequestAccessPage", () => {
  it("renders the public assisted intake page", () => {
    const html = renderToStaticMarkup(<RequestAccessPage />);

    expect(html).toContain("Encontrá el plan correcto para tu operación");
    expect(html).toContain("cotizador asistido comercial");
    expect(html).toContain("Plan recomendado");
    expect(html).toContain("no crea aprovisionamiento automático");
  });
});
