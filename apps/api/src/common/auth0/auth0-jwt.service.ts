import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import jwt, { type VerifyOptions } from "jsonwebtoken";
import { createPublicKey } from "node:crypto";
import type { JwtHeader, SigningKeyCallback } from "jsonwebtoken";
import type { Auth0JwtClaims } from "./auth0-tenant-resolver";

type JwksKey = { kty: string; kid: string; use: string; n: string; e: string; alg: string };
type JwtDiagnostics = {
  format: "jwt" | "opaque";
  alg?: string;
  kid?: string;
  iss?: string;
  aud?: string | string[];
  orgId?: string;
};

export const AUTH0_ISSUER_KEY = "AUTH0_ISSUER";
export const AUTH0_AUDIENCE_KEY = "AUTH0_AUDIENCE";

export function normalizeAuth0Issuer(issuer: string): string {
  return issuer.trim().replace(/\/+$/, "") + "/";
}

export function buildAuth0JwksUrl(issuer: string): string {
  return `${normalizeAuth0Issuer(issuer)}.well-known/jwks.json`;
}

export function getJwtDiagnostics(token: string): JwtDiagnostics {
  const decoded = jwt.decode(token, { complete: true });

  if (!decoded || typeof decoded === "string") {
    return { format: "opaque" };
  }

  const payload = decoded.payload as jwt.JwtPayload;
  const diagnostics: JwtDiagnostics = {
    format: "jwt",
    alg: decoded.header.alg
  };

  if (decoded.header.kid) {
    diagnostics.kid = decoded.header.kid;
  }

  if (typeof payload.iss === "string") {
    diagnostics.iss = payload.iss;
  }

  if (typeof payload.aud === "string" || Array.isArray(payload.aud)) {
    diagnostics.aud = payload.aud;
  }

  if (typeof payload.org_id === "string") {
    diagnostics.orgId = payload.org_id;
  }

  return diagnostics;
}

function verifyJwtAsync(
  token: string,
  getKey: (header: JwtHeader, callback: SigningKeyCallback) => void,
  options: VerifyOptions
): Promise<jwt.JwtPayload> {
  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, options, (err, decoded) => {
      if (err || !decoded) {
        reject(err ?? new Error("Empty token"));
      } else {
        resolve(decoded as jwt.JwtPayload);
      }
    });
  });
}

@Injectable()
export class Auth0JwtService {
  private readonly logger = new Logger(Auth0JwtService.name);
  private jwksCache: { keys: JwksKey[] } | null = null;
  private jwksCacheTime = 0;
  private readonly jwksTtlMs = 86_400_000;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async verifyAndDecode(token: string): Promise<Auth0JwtClaims> {
    const issuer = this.config.get<string>(AUTH0_ISSUER_KEY);
    const audience = this.config.get<string>(AUTH0_AUDIENCE_KEY);

    if (!issuer || !audience) {
      throw new Error("Auth0 config missing: AUTH0_ISSUER and AUTH0_AUDIENCE must be set.");
    }

    const normalizedIssuer = normalizeAuth0Issuer(issuer);
    const keyResolver = await this.createKeyResolver(normalizedIssuer);
    const diagnostics = getJwtDiagnostics(token);

    try {
      const decoded = await verifyJwtAsync(token, keyResolver, {
        algorithms: ["RS256"],
        issuer: normalizedIssuer,
        audience
      });
      return decoded as Auth0JwtClaims;
    } catch (err) {
      this.logger.warn(
        `jwt_verification_failed error="${(err as Error).message}" expected_issuer="${normalizedIssuer}" expected_audience="${audience}" token_format="${diagnostics.format}" token_alg="${diagnostics.alg ?? "unknown"}" token_kid="${diagnostics.kid ?? "unknown"}" token_iss="${diagnostics.iss ?? "unknown"}" token_aud="${JSON.stringify(diagnostics.aud ?? "unknown")}" token_org_id="${diagnostics.orgId ?? "unknown"}"`
      );
      throw new Error((err as Error).message);
    }
  }

  private async createKeyResolver(issuer: string): Promise<(header: JwtHeader, callback: SigningKeyCallback) => void> {
    const jwks = await this.fetchJwks(issuer);

    return (header, callback) => {
      const key = jwks.keys.find((k) => k.kid === header.kid);
      if (!key) {
        this.logger.warn(`jwks_key_not_found kid="${header.kid ?? "unknown"}"`);
        return callback(new Error("Key not found"));
      }

      try {
        const publicKey = createPublicKey({ format: "jwk", key: key as never });
        callback(null, publicKey);
      } catch {
        callback(new Error("Failed to parse JWK key"));
      }
    };
  }

  private async fetchJwks(issuer: string): Promise<{ keys: JwksKey[] }> {
    const now = Date.now();
    if (this.jwksCache && now - this.jwksCacheTime < this.jwksTtlMs) {
      return this.jwksCache;
    }

    const jwksUrl = buildAuth0JwksUrl(issuer);
    this.logger.log(`fetching_jwks url="${jwksUrl}"`);

    const response = await fetch(jwksUrl);
    if (!response.ok) {
      throw new Error(`JWKS fetch failed: ${response.status}`);
    }

    const data = (await response.json()) as { keys: JwksKey[] };
    this.jwksCache = data;
    this.jwksCacheTime = now;

    return data;
  }
}
