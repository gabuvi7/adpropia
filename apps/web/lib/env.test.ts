import { describe, it, expect } from "vitest";
import { parseServerEnv } from "./env";

describe("parseServerEnv", () => {
  const validEnv: Record<string, string> = {
    AUTH0_SECRET: "a-long-secret-at-least-32-chars-long!",
    APP_BASE_URL: "http://localhost:3000",
    AUTH0_DOMAIN: "dev-adpropia.us.auth0.com",
    AUTH0_CLIENT_ID: "client-id-123",
    AUTH0_CLIENT_SECRET: "client-secret-456",
    AUTH0_AUDIENCE: "https://api.adpropia.com.ar",
    ADPROPIA_API_BASE_URL: "http://localhost:3001",
  };

  it("returns parsed values for valid server env", () => {
    const result = parseServerEnv(validEnv);
    expect(result.AUTH0_DOMAIN).toBe("dev-adpropia.us.auth0.com");
    expect(result.AUTH0_AUDIENCE).toBe("https://api.adpropia.com.ar");
    expect(result.ADPROPIA_API_BASE_URL).toBe("http://localhost:3001");
  });

  it("throws when AUTH0_SECRET is missing", () => {
    const { AUTH0_SECRET: _, ...incomplete } = validEnv;
    expect(() => parseServerEnv(incomplete)).toThrow();
  });

  it("throws when APP_BASE_URL is not a valid URL", () => {
    expect(() => parseServerEnv({ ...validEnv, APP_BASE_URL: "not-a-url" })).toThrow();
  });

  it("throws when AUTH0_AUDIENCE is missing", () => {
    const { AUTH0_AUDIENCE: _, ...incomplete } = validEnv;
    expect(() => parseServerEnv(incomplete)).toThrow();
  });

  it("throws when ADPROPIA_API_BASE_URL is not a valid URL", () => {
    expect(() => parseServerEnv({ ...validEnv, ADPROPIA_API_BASE_URL: "" })).toThrow();
  });
});
