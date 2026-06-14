import { Inject, Injectable, Logger, type NestMiddleware } from "@nestjs/common";
import type { Request, Response } from "express";
import { RequestContextService } from "../request-context/request-context.service";

type SafeRequestSummary = Readonly<{
  event: "http_request_completed";
  requestId: string | null;
  tenantId: string | null;
  userId: string | null;
  role: string | null;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
}>;

function safePath(request: Request): string {
  if (typeof request.path === "string" && request.path) {
    return request.path;
  }

  const rawPath = request.originalUrl || request.url || "/";
  return rawPath.split("?", 1)[0] || "/";
}

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggingMiddleware.name);

  constructor(@Inject(RequestContextService) private readonly contextService: RequestContextService) {}

  use(request: Request, response: Response, next: () => void): void {
    const startedAt = Date.now();
    const context = this.contextService.getOptional();

    response.on("finish", () => {
      const summary: SafeRequestSummary = {
        event: "http_request_completed",
        requestId: context?.requestId ?? null,
        tenantId: context?.tenantId ?? null,
        userId: context?.userId ?? null,
        role: context?.role ?? null,
        method: request.method,
        path: safePath(request),
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt
      };

      this.logger.log(summary);
    });

    next();
  }
}
