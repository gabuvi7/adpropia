import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import jwt, { type VerifyOptions } from "jsonwebtoken";
import { createPublicKey } from "node:crypto";
import type { JwtHeader, SigningKeyCallback } from "jsonwebtoken";
import type { Auth0JwtClaims } from "./auth0-tenant-resolver";

type JwksKey = { kty: string; kid: string; use: string; n: string; e: string; alg: string };

export const AUTH0_ISSUER_KEY = "AUTH0_ISSUER";
export const AUTH0_AUDIENCE_KEY = "AUTH0_AUDIENCE";

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

  constructor(private readonly config: ConfigService) {}

  async verifyAndDecode(token: string): Promise<Auth0JwtClaims> {
    const issuer = this.config.get<string>(AUTH0_ISSUER_KEY);
    const audience = this.config.get<string>(AUTH0_AUDIENCE_KEY);

    if (!issuer || !audience) {
      throw new Error("Auth0 config missing: AUTH0_ISSUER and AUTH0_AUDIENCE must be set.");
    }

    const keyResolver = await this.createKeyResolver(issuer);

    try {
      const decoded = await verifyJwtAsync(token, keyResolver, {
        algorithms: ["RS256"],
        issuer,
        audience
      });
      return decoded as Auth0JwtClaims;
    } catch (err) {
      this.logger.warn({ event: "jwt_verification_failed", error: (err as Error).message });
      throw new Error("Token invalido.");
    }
  }

  private async createKeyResolver(issuer: string): Promise<(header: JwtHeader, callback: SigningKeyCallback) => void> {
    const jwks = await this.fetchJwks(issuer);

    return (header, callback) => {
      const key = jwks.keys.find((k) => k.kid === header.kid);
      if (!key) {
        this.logger.warn({ event: "jwks_key_not_found", kid: header.kid });
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

    const jwksUrl = `${issuer.replace(/\/$/, "")}/.well-known/jwks.json`;
    this.logger.log({ event: "fetching_jwks", url: jwksUrl });

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
