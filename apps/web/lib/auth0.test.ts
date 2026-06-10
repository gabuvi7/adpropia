import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth0ClientMock = vi.fn();

vi.mock("@auth0/nextjs-auth0/server", () => ({
  Auth0Client: auth0ClientMock,
}));

const baseEnv = {
  AUTH0_SECRET: "a-long-secret-at-least-32-chars-long!",
  APP_BASE_URL: "http://localhost:3000",
  AUTH0_DOMAIN: "dev-adpropia.us.auth0.com",
  AUTH0_CLIENT_ID: "client-id-123",
  AUTH0_CLIENT_SECRET: "client-secret-456",
  AUTH0_AUDIENCE: "https://api.adpropia.com.ar",
  ADPROPIA_API_BASE_URL: "http://localhost:3001",
};

describe("auth0 client configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    auth0ClientMock.mockClear();
    process.env = { ...originalEnv, ...baseEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("includes the configured organization in authorization parameters", async () => {
    process.env.AUTH0_ORGANIZATION_ID = "org_abc123";

    await import("./auth0");

    expect(auth0ClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        authorizationParameters: expect.objectContaining({
          audience: "https://api.adpropia.com.ar",
          scope: "openid profile email",
          organization: "org_abc123",
        }),
      }),
    );
  });

  it("omits organization from authorization parameters when it is absent", async () => {
    delete process.env.AUTH0_ORGANIZATION_ID;

    await import("./auth0");

    const config = auth0ClientMock.mock.calls[0]?.[0];
    expect(config.authorizationParameters).toEqual({
      audience: "https://api.adpropia.com.ar",
      scope: "openid profile email",
    });
  });
});
