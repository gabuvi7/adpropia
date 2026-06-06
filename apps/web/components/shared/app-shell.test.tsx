import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AppShell } from "./app-shell";

describe("AppShell", () => {
  it("renders tenant name and children", () => {
    const html = renderToStaticMarkup(
      <AppShell tenantName="Test Agency">
        <p>child content</p>
      </AppShell>,
    );
    expect(html).toContain("Test Agency");
    expect(html).toContain("child content");
  });

  it("renders user info when provided", () => {
    const html = renderToStaticMarkup(
      <AppShell tenantName="Agency" userName="John Doe" role="ADMIN" logoutUrl="/auth/logout">
        <p>content</p>
      </AppShell>,
    );
    expect(html).toContain("John Doe");
    expect(html).toContain("ADMIN");
    expect(html).toContain("/auth/logout");
  });

  it("does not render user section when no userName", () => {
    const html = renderToStaticMarkup(
      <AppShell tenantName="Agency">
        <p>content</p>
      </AppShell>,
    );
    expect(html).not.toContain("Salir");
  });
});
