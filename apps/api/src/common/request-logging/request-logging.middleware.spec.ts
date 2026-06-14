import "reflect-metadata";
import { EventEmitter } from "node:events";
import { Logger } from "@nestjs/common";
import { SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants";
import type { Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RequestContextService } from "../request-context/request-context.service";
import { RequestLoggingMiddleware } from "./request-logging.middleware";

function createResponse(statusCode: number): Response & EventEmitter {
  const response = new EventEmitter() as Response & EventEmitter;
  response.statusCode = statusCode;
  return response;
}

describe("RequestLoggingMiddleware", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("declares explicit RequestContextService injection token", () => {
    const dependencies = Reflect.getMetadata(
      SELF_DECLARED_DEPS_METADATA,
      RequestLoggingMiddleware
    ) as Array<{ index: number; param: unknown }>;

    expect(dependencies).toEqual(expect.arrayContaining([{ index: 0, param: RequestContextService }]));
  });

  it("logs one safe request summary when the response finishes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const logSpy = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const middleware = new RequestLoggingMiddleware(new RequestContextService());
    const response = createResponse(204);
    const next = vi.fn();

    middleware.use({ method: "GET", path: "/health", originalUrl: "/health?token=secret" } as Request, response, next);
    vi.setSystemTime(1_037);
    response.emit("finish");

    expect(next).toHaveBeenCalledOnce();
    expect(logSpy).toHaveBeenCalledOnce();
    expect(logSpy).toHaveBeenCalledWith({
      event: "http_request_completed",
      requestId: null,
      tenantId: null,
      userId: null,
      role: null,
      method: "GET",
      path: "/health",
      statusCode: 204,
      durationMs: 37
    });
  });

  it("includes request context fields when they are available", () => {
    vi.useFakeTimers();
    vi.setSystemTime(2_000);
    const logSpy = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const contextService = new RequestContextService();
    const middleware = new RequestLoggingMiddleware(contextService);
    const response = createResponse(201);

    contextService.run(
      { requestId: "req-1", tenantId: "tenant-1", userId: "user-1", role: "ADMIN" },
      () => {
        middleware.use({ method: "POST", path: "/contracts" } as Request, response, vi.fn());
      }
    );

    vi.setSystemTime(2_012);
    response.emit("finish");

    expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({
      requestId: "req-1",
      tenantId: "tenant-1",
      userId: "user-1",
      role: "ADMIN",
      statusCode: 201,
      durationMs: 12
    }));
  });

  it("does not log body, headers, cookies, authorization, query values, or full query URLs", () => {
    vi.useFakeTimers();
    vi.setSystemTime(3_000);
    const logSpy = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const middleware = new RequestLoggingMiddleware(new RequestContextService());
    const response = createResponse(200);
    const request = {
      method: "PATCH",
      url: "/payments?token=query-secret&search=sensitive",
      originalUrl: "/payments?token=query-secret&search=sensitive",
      headers: { authorization: "Bearer secret", cookie: "session=secret" },
      cookies: { session: "secret" },
      body: { password: "secret" },
      query: { token: "query-secret" }
    } as unknown as Request;

    middleware.use(request, response, vi.fn());
    vi.setSystemTime(3_005);
    response.emit("finish");

    const payload = logSpy.mock.calls[0]?.[0];
    expect(payload).toEqual(expect.objectContaining({ path: "/payments", durationMs: 5 }));
    expect(JSON.stringify(payload)).not.toContain("secret");
    expect(JSON.stringify(payload)).not.toContain("authorization");
    expect(JSON.stringify(payload)).not.toContain("cookie");
    expect(JSON.stringify(payload)).not.toContain("password");
    expect(JSON.stringify(payload)).not.toContain("query-secret");
  });
});
