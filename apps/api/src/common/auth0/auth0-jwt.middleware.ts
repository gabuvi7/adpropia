import { Injectable, type NestMiddleware, UnauthorizedException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { RequestContextService } from "../request-context/request-context.service";
import { Auth0TenantResolver } from "./auth0-tenant-resolver";
import { Auth0JwtService } from "./auth0-jwt.service";

type HeaderCarrier = { headers: Record<string, string | string[] | undefined> };

function firstHeader(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

@Injectable()
export class Auth0JwtMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: Auth0JwtService,
    private readonly contextService: RequestContextService,
    private readonly tenantResolver: Auth0TenantResolver
  ) {}

  async use(request: HeaderCarrier, _response: unknown, next: () => void): Promise<void> {
    const authHeader = firstHeader(request.headers, "authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      if (process.env.NODE_ENV === "production") {
        throw new UnauthorizedException("Token requerido.");
      }
      next();
      return;
    }

    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      if (process.env.NODE_ENV === "production") {
        throw new UnauthorizedException("Token vacio.");
      }
      next();
      return;
    }

    const claims = await this.jwtService.verifyAndDecode(token).catch(() => {
      throw new UnauthorizedException("Token invalido.");
    });

    const resolution = await this.tenantResolver.resolve(claims).catch(() => {
      throw new UnauthorizedException("Acceso denegado.");
    });

    const context = this.contextService.fromJwtResolution(resolution, (claims.jti as string | undefined) ?? randomUUID());

    this.contextService.run(context, next);
  }
}
