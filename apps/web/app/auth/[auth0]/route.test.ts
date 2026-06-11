import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse, type NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockMiddleware: vi.fn(),
}));

vi.mock("../../../lib/auth0", () => ({
  auth0: {
    getSession: mocks.mockGetSession,
    middleware: mocks.mockMiddleware,
  },
}));

import { GET, POST } from "./route";

function mockRequest(path: string): NextRequest {
  const url = new URL(`http://localhost:3000${path}`);
  return { nextUrl: url } as NextRequest;
}

describe("Auth0 route handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockMiddleware.mockResolvedValue(NextResponse.next());
  });

  it("redirects authenticated GET /auth/login requests to /dashboard", async () => {
    const req = mockRequest("/auth/login");
    mocks.mockGetSession.mockResolvedValue({ user: { sub: "auth0|123" } });

    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard");
    expect(mocks.mockGetSession).toHaveBeenCalledWith(req);
    expect(mocks.mockMiddleware).not.toHaveBeenCalled();
  });

  it("delegates GET /auth/login without a session to Auth0 middleware", async () => {
    const req = mockRequest("/auth/login");
    mocks.mockGetSession.mockResolvedValue(null);

    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mocks.mockGetSession).toHaveBeenCalledWith(req);
    expect(mocks.mockMiddleware).toHaveBeenCalledWith(req);
  });

  it("delegates GET /auth/callback to Auth0 middleware without dashboard redirect", async () => {
    const req = mockRequest("/auth/callback");

    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(mocks.mockGetSession).not.toHaveBeenCalled();
    expect(mocks.mockMiddleware).toHaveBeenCalledWith(req);
  });

  it("delegates POST /auth/login to Auth0 middleware", async () => {
    const req = mockRequest("/auth/login");

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mocks.mockGetSession).not.toHaveBeenCalled();
    expect(mocks.mockMiddleware).toHaveBeenCalledWith(req);
  });
});
