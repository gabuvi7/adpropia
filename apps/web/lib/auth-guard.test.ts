import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { requireSession } from "./auth-guard";

function mockRequest(path: string): NextRequest {
  const url = new URL(`http://localhost:3000${path}`);
  return { nextUrl: url } as NextRequest;
}

describe("requireSession", () => {
  it("redirects to /auth/login when session is null", () => {
    const req = mockRequest("/dashboard");
    const result = requireSession(req, null);

    expect(result?.status).toBe(307);
    expect(result?.headers.get("location")).toBe(
      "http://localhost:3000/auth/login",
    );
  });

  it("allows request to continue when session exists", () => {
    const req = mockRequest("/dashboard");
    const result = requireSession(req, { user: { sub: "auth0|123" } });

    expect(result).toBeNull();
  });

  it("redirects to the same login URL regardless of request path", () => {
    const settingsReq = mockRequest("/dashboard/settings");
    const result = requireSession(settingsReq, null);

    expect(result?.headers.get("location")).toBe(
      "http://localhost:3000/auth/login",
    );
  });

  it("preserves origin in redirect URL when using different base URL", () => {
    const url = new URL("https://app.adpropia.com.ar/dashboard");
    const req = { nextUrl: url } as NextRequest;
    const result = requireSession(req, null);

    expect(result?.headers.get("location")).toBe(
      "https://app.adpropia.com.ar/auth/login",
    );
  });
});
