import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockGetAccessToken: vi.fn(),
}));

vi.mock("../../../../lib/auth0", () => ({
  auth0: {
    getSession: mocks.mockGetSession,
    getAccessToken: mocks.mockGetAccessToken,
  },
}));

import { GET } from "./route";

const originalEnv = process.env;
const originalFetch = globalThis.fetch;

function createJwtLikeToken(payloadOverrides: Record<string, unknown> = {}) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "kid-123" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iss: "https://example.us.auth0.com/", aud: "https://api.example.com", ...payloadOverrides })
  ).toString("base64url");
  return `${header}.${payload}.signature`;
}

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns bootstrap data when authenticated", async () => {
    mocks.mockGetSession.mockResolvedValue({ user: { sub: "auth0|123" } });
    mocks.mockGetAccessToken.mockResolvedValue({ token: "api-token-abc" });

    process.env = { ...process.env, ADPROPIA_API_BASE_URL: "http://localhost:3001" };

    const mockResponse = new Response(JSON.stringify({ userId: "user-1", tenantId: "tenant-1", tenantName: "Test Agency", role: "ADMIN" }), { status: 200 });
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ userId: "user-1", tenantId: "tenant-1", tenantName: "Test Agency", role: "ADMIN" });
    expect(mocks.mockGetSession).toHaveBeenCalledOnce();
    expect(mocks.mockGetAccessToken).toHaveBeenCalledOnce();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:3001/auth/me",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer api-token-abc" }),
      }),
    );
  });

  it("returns 401 when no session", async () => {
    mocks.mockGetSession.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toHaveProperty("error");
    expect(mocks.mockGetAccessToken).not.toHaveBeenCalled();
  });

  it("returns 401 when access token is missing", async () => {
    mocks.mockGetSession.mockResolvedValue({ user: { sub: "auth0|123" } });
    mocks.mockGetAccessToken.mockResolvedValue({ token: null });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toHaveProperty("error");
  });

  it("returns 502 when backend is unreachable", async () => {
    mocks.mockGetSession.mockResolvedValue({ user: { sub: "auth0|123" } });
    mocks.mockGetAccessToken.mockResolvedValue({ token: "api-token-abc" });

    process.env = { ...process.env, ADPROPIA_API_BASE_URL: "http://localhost:3001" };

    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toHaveProperty("error");
  });

  it("surfaces backend 401 denials without exposing tokens or secrets", async () => {
    const token = createJwtLikeToken({ org_id: "org_abc123" });
    mocks.mockGetSession.mockResolvedValue({ user: { sub: "auth0|123" } });
    mocks.mockGetAccessToken.mockResolvedValue({ token });
    process.env = { ...process.env, ADPROPIA_API_BASE_URL: "http://localhost:3001" };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const leakedBackendText = `Unauthorized token=${token} AUTH0_CLIENT_SECRET=shh`;
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(leakedBackendText, { status: 401 }));

    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(401);
    expect(body).toContain("Error del servidor.");
    expect(body).not.toContain(token);
    expect(body).not.toContain("AUTH0_CLIENT_SECRET");
    expect(body).not.toContain("shh");
    expect(warnSpy.mock.calls.join("\n")).not.toContain(token);
    expect(warnSpy.mock.calls.join("\n")).toContain('token_org_id="org_abc123"');
  });

  it("logs unknown org_id when the access token has no organization context", async () => {
    const token = createJwtLikeToken();
    mocks.mockGetSession.mockResolvedValue({ user: { sub: "auth0|123" } });
    mocks.mockGetAccessToken.mockResolvedValue({ token });
    process.env = { ...process.env, ADPROPIA_API_BASE_URL: "http://localhost:3001" };
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ userId: "user-1" }), { status: 200 }));

    await GET();

    expect(infoSpy.mock.calls.join("\n")).toContain('token_org_id="unknown"');
    expect(infoSpy.mock.calls.join("\n")).not.toContain(token);
  });

  it("surfaces backend 403 denials without falling back to access or leaking backend detail", async () => {
    const token = createJwtLikeToken();
    mocks.mockGetSession.mockResolvedValue({ user: { sub: "auth0|123" } });
    mocks.mockGetAccessToken.mockResolvedValue({ token });
    process.env = { ...process.env, ADPROPIA_API_BASE_URL: "http://localhost:3001" };
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("Forbidden bearer api-token-abc AUTH0_SECRET=hidden", { status: 403 })
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "Error del servidor." });
    expect(JSON.stringify(body)).not.toContain("api-token-abc");
    expect(JSON.stringify(body)).not.toContain("AUTH0_SECRET");
  });

  it("does not expose access token or secrets in error response", async () => {
    mocks.mockGetSession.mockResolvedValue(null);

    const response = await GET();
    const body = await response.text();

    expect(body).not.toContain("api-token");
    expect(body).not.toContain("AUTH0_CLIENT_SECRET");
    expect(body).not.toContain("AUTH0_SECRET");
  });
});
