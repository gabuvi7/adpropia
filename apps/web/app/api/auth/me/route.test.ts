import { describe, it, expect, vi, beforeEach } from "vitest";

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

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns bootstrap data when authenticated", async () => {
    mocks.mockGetSession.mockResolvedValue({ user: { sub: "auth0|123" } });
    mocks.mockGetAccessToken.mockResolvedValue({ token: "api-token-abc" });

    const origEnv = process.env;
    process.env = { ...origEnv, ADPROPIA_API_BASE_URL: "http://localhost:3001" };

    const mockResponse = new Response(JSON.stringify({ userId: "user-1", tenantId: "tenant-1", tenantName: "Test Agency", role: "ADMIN" }), { status: 200 });
    const originalFetch = globalThis.fetch;
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

    process.env = origEnv;
    globalThis.fetch = originalFetch;
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

    const origEnv = process.env;
    process.env = { ...origEnv, ADPROPIA_API_BASE_URL: "http://localhost:3001" };

    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toHaveProperty("error");

    process.env = origEnv;
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
