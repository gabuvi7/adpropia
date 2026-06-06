import { describe, it, expect, vi, beforeEach } from "vitest";

import { fetchBootstrap } from "./bootstrap";

describe("fetchBootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns bootstrap data on success", async () => {
    const data = { userId: "u1", tenantId: "t1", tenantName: "Test Agency", role: "ADMIN" };
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(data), { status: 200 }),
    );

    const result = await fetchBootstrap("session=abc");

    expect(result).toEqual(data);
  });

  it("returns null on non-ok response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("Unauthorized", { status: 401 }),
    );

    const result = await fetchBootstrap("session=abc");

    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await fetchBootstrap("session=abc");

    expect(result).toBeNull();
  });

  it("forwards cookie header with the backend request", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    globalThis.fetch = mockFetch;

    await fetchBootstrap("session=xyz");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/me"),
      expect.objectContaining({
        headers: expect.objectContaining({ cookie: "session=xyz" }),
      }),
    );
  });

  it("uses APP_BASE_URL env var for the request URL", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    globalThis.fetch = mockFetch;

    await fetchBootstrap("session=abc");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringMatching(/^http:\/\/localhost:3000\/api\/auth\/me/),
      expect.any(Object),
    );
  });
});
