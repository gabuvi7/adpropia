import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const originalEnv = process.env;
const originalFetch = globalThis.fetch;

const validPayload = {
  companyName: "Inmobiliaria Centro",
  contactName: "Martina Díaz",
  email: "martina@example.com",
  phone: "+54 11 5555-5555",
  rentalAdministrationUnits: 125,
  saleUnits: 8,
  users: 4,
  selectedModules: ["RENTALS_AND_CONTRACTS"],
  turnstileToken: "token"
};

describe("POST /api/access-requests", () => {
  beforeEach(() => {
    process.env = { ...originalEnv, ADPROPIA_API_BASE_URL: "http://localhost:3001" };
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("proxies valid requests to the NestJS access request endpoint", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "access-request-1", recommendedPlan: "PROFESIONAL" }), { status: 201 }));

    const response = await POST(new Request("http://localhost/api/access-requests", {
      method: "POST",
      body: JSON.stringify(validPayload)
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ id: "access-request-1", recommendedPlan: "PROFESIONAL" });
    expect(globalThis.fetch).toHaveBeenCalledWith("http://localhost:3001/access-requests", expect.objectContaining({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validPayload)
    }));
  });

  it("returns 400 without proxying invalid request bodies", async () => {
    globalThis.fetch = vi.fn();

    const response = await POST(new Request("http://localhost/api/access-requests", {
      method: "POST",
      body: JSON.stringify({ companyName: "missing fields" })
    }));

    expect(response.status).toBe(400);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("returns 502 when the backend is unreachable", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const response = await POST(new Request("http://localhost/api/access-requests", {
      method: "POST",
      body: JSON.stringify(validPayload)
    }));

    expect(response.status).toBe(502);
  });
});
