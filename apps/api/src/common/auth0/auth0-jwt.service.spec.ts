import jwt from "jsonwebtoken";
import { generateKeyPairSync } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants";
import { ConfigService } from "@nestjs/config";
import { Auth0JwtService, buildAuth0JwksUrl, getJwtDiagnostics, normalizeAuth0Issuer } from "./auth0-jwt.service";

const issuer = "https://example.us.auth0.com/";
const audience = "https://api.example.com";

function createConfig(overrides: Record<string, string | undefined> = {}) {
  const values: Record<string, string | undefined> = {
    AUTH0_ISSUER: issuer,
    AUTH0_AUDIENCE: audience,
    ...overrides
  };

  return {
    get: vi.fn((key: string) => values[key])
  } as unknown as ConfigService;
}

function createSignedJwtFixture(overrides: jwt.SignOptions & { issuer?: string; audience?: string | string[] } = {}) {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicJwk = publicKey.export({ format: "jwk" }) as JsonWebKey;
  const kid = "runtime-kid-1";
  const token = jwt.sign(
    {
      sub: "auth0|user-1",
      org_id: "org_123",
      email: "agent@example.com"
    },
    privateKey,
    {
      algorithm: "RS256",
      issuer: overrides.issuer ?? issuer,
      audience: overrides.audience ?? audience,
      keyid: kid,
      expiresIn: "5m"
    }
  );

  return {
    kid,
    token,
    jwks: {
      keys: [
        {
          ...publicJwk,
          kid,
          use: "sig",
          alg: "RS256"
        }
      ]
    }
  };
}

function base64UrlEncode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

describe("Auth0JwtService issuer normalization", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("declares explicit ConfigService injection token", () => {
    const dependencies = Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, Auth0JwtService) as Array<{
      index: number;
      param: unknown;
    }>;

    expect(dependencies).toEqual(expect.arrayContaining([{ index: 0, param: ConfigService }]));
  });

  it("normalizes Auth0 issuer with trailing slash for exact JWT issuer matching", () => {
    expect(normalizeAuth0Issuer("https://example.us.auth0.com")).toBe("https://example.us.auth0.com/");
    expect(normalizeAuth0Issuer("https://example.us.auth0.com/")).toBe("https://example.us.auth0.com/");
    expect(normalizeAuth0Issuer(" https://example.us.auth0.com/// ")).toBe("https://example.us.auth0.com/");
  });

  it("builds the JWKS URL from the normalized issuer", () => {
    expect(buildAuth0JwksUrl("https://example.us.auth0.com")).toBe(
      "https://example.us.auth0.com/.well-known/jwks.json"
    );
  });

  it("extracts safe diagnostics without verifying or logging the token", () => {
    const token = [
      base64UrlEncode({ alg: "RS256", typ: "JWT", kid: "kid-123" }),
      base64UrlEncode({ iss: "https://example.us.auth0.com/", aud: "https://api.example.com", org_id: "org_abc123" }),
      "signature"
    ].join(".");

    expect(getJwtDiagnostics(token)).toEqual({
      format: "jwt",
      alg: "RS256",
      kid: "kid-123",
      iss: "https://example.us.auth0.com/",
      aud: "https://api.example.com",
      orgId: "org_abc123"
    });
  });

  it("marks non-JWT tokens as opaque", () => {
    expect(getJwtDiagnostics("opaque-access-token")).toEqual({ format: "opaque" });
  });

  it("verifies a real RS256 Auth0 JWT with JWKS, issuer, and audience", async () => {
    const fixture = createSignedJwtFixture();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(fixture.jwks), { status: 200 })
    );
    const service = new Auth0JwtService(createConfig());

    const decoded = await service.verifyAndDecode(fixture.token);

    expect(decoded).toEqual(
      expect.objectContaining({
        sub: "auth0|user-1",
        org_id: "org_123",
        iss: issuer,
        aud: audience,
        email: "agent@example.com"
      })
    );
    expect(fetchMock).toHaveBeenCalledWith("https://example.us.auth0.com/.well-known/jwks.json");
  });

  it("rejects a real RS256 JWT when the audience does not match", async () => {
    const fixture = createSignedJwtFixture({ audience: "https://wrong.example.com" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(fixture.jwks), { status: 200 }));
    const service = new Auth0JwtService(createConfig());

    await expect(service.verifyAndDecode(fixture.token)).rejects.toThrow("jwt audience invalid");
  });
});
