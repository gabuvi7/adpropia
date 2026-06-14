import {
  HttpException,
  Inject,
  Injectable,
  type NestMiddleware,
  UnauthorizedException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { normalizeRequestIdHeader } from "../request-context/request-id";
import { RequestContextService } from "../request-context/request-context.service";
import { Auth0TenantResolver } from "./auth0-tenant-resolver";
import { Auth0JwtService } from "./auth0-jwt.service";

type HeaderCarrier = { headers: Record<string, string | string[] | undefined> };

function firstHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function invalidTokenMessage(err: unknown): string {
  if (
    process.env.NODE_ENV === "production" ||
    !(err instanceof Error) ||
    !err.message
  ) {
    return "Token invalido.";
  }

  return `Token invalido. Detalle: ${err.message}`;
}

function requestIdFromHeaders(
  headers: Record<string, string | string[] | undefined>,
): string | undefined {
  return normalizeRequestIdHeader(
    headers["x-request-id"] ?? headers["X-Request-Id"],
  );
}

@Injectable()
export class Auth0JwtMiddleware implements NestMiddleware {
  constructor(
    @Inject(Auth0JwtService)
    private readonly jwtService: Auth0JwtService,
    @Inject(RequestContextService)
    private readonly contextService: RequestContextService,
    @Inject(Auth0TenantResolver)
    private readonly tenantResolver: Auth0TenantResolver,
  ) {}

  async use(
    request: HeaderCarrier,
    _response: unknown,
    next: () => void,
  ): Promise<void> {
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

    const claims = await this.jwtService
      .verifyAndDecode(token)
      .catch((err: unknown) => {
        throw new UnauthorizedException(invalidTokenMessage(err));
      });

    const resolution = await this.tenantResolver
      .resolve(claims)
      .catch((err: unknown) => {
        if (err instanceof HttpException) {
          throw err;
        }

        throw new UnauthorizedException("Acceso denegado.");
      });

    const requestId =
      requestIdFromHeaders(request.headers) ??
      (claims.jti as string | undefined) ??
      randomUUID();
    const context = this.contextService.fromJwtResolution(
      resolution,
      requestId,
    );

    this.contextService.run(context, next);
  }
}
