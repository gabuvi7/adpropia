import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  mockMiddleware: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("./lib/auth0", () => ({
  auth0: {
    middleware: mocks.mockMiddleware,
    getSession: mocks.mockGetSession,
  },
}));

import { proxy } from "./proxy";

function mockRequest(path: string): NextRequest {
  const url = new URL(`http://localhost:3000${path}`);
  return { nextUrl: url } as NextRequest;
}

describe("proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockMiddleware.mockResolvedValue(NextResponse.next());
  });

  it("redirects unauthenticated /dashboard to /auth/login", async () => {
    mocks.mockGetSession.mockResolvedValue(null);

    const req = mockRequest("/dashboard");
    const res = await proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/auth/login",
    );
  });

  it("allows authenticated /dashboard request to continue", async () => {
    mocks.mockGetSession.mockResolvedValue({ user: { sub: "auth0|123" } });

    const req = mockRequest("/dashboard");
    const res = await proxy(req);

    expect(res.status).toBe(200);
  });

  it("calls auth0.middleware before checking session", async () => {
    mocks.mockGetSession.mockResolvedValue({ user: { sub: "auth0|123" } });

    const req = mockRequest("/dashboard");
    await proxy(req);

    expect(mocks.mockMiddleware).toHaveBeenCalledWith(req);
    expect(mocks.mockGetSession).toHaveBeenCalledWith(req);
  });
});
