import { describe, expect, it } from "vitest";
import { SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants";
import { ConfigService } from "@nestjs/config";
import { Auth0JwtService, buildAuth0JwksUrl, getJwtDiagnostics, normalizeAuth0Issuer } from "./auth0-jwt.service";

function base64UrlEncode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

describe("Auth0JwtService issuer normalization", () => {
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
      base64UrlEncode({ iss: "https://example.us.auth0.com/", aud: "https://api.example.com" }),
      "signature"
    ].join(".");

    expect(getJwtDiagnostics(token)).toEqual({
      format: "jwt",
      alg: "RS256",
      kid: "kid-123",
      iss: "https://example.us.auth0.com/",
      aud: "https://api.example.com"
    });
  });

  it("marks non-JWT tokens as opaque", () => {
    expect(getJwtDiagnostics("opaque-access-token")).toEqual({ format: "opaque" });
  });
});
