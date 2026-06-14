import "reflect-metadata";
import { SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RequestContext } from "./request-context";
import { TemporaryHeaderRequestContextMiddleware } from "./request-context.middleware";
import { InvalidRequestContextError, RequestContextService } from "./request-context.service";

function createMiddleware(): {
  middleware: TemporaryHeaderRequestContextMiddleware;
  service: RequestContextService;
} {
  const service = new RequestContextService();
  return { middleware: new TemporaryHeaderRequestContextMiddleware(service), service };
}

function createRequest(requestId?: string): { headers: Record<string, string | undefined> } {
  return {
    headers: {
      "x-tenant-id": "tenant-1",
      "x-user-id": "user-1",
      "x-role": "OPERATOR",
      "x-request-id": requestId
    }
  };
}

describe("TemporaryHeaderRequestContextMiddleware", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it("declares explicit RequestContextService injection token", () => {
    const dependencies = Reflect.getMetadata(
      SELF_DECLARED_DEPS_METADATA,
      TemporaryHeaderRequestContextMiddleware
    ) as Array<{ index: number; param: unknown }>;

    expect(dependencies).toEqual(expect.arrayContaining([{ index: 0, param: RequestContextService }]));
  });

  it("preserves a valid dev/test x-request-id", () => {
    const { middleware, service } = createMiddleware();
    let context: RequestContext | undefined;

    middleware.use(createRequest(" dev-req_123.456:789 "), undefined, () => {
      context = service.get();
    });

    expect(context).toEqual(expect.objectContaining({ requestId: "dev-req_123.456:789" }));
  });

  it.each(["   ", "bad\nrequest", "x".repeat(129)])(
    "falls back for unsafe dev/test x-request-id %s",
    (requestId) => {
      const { middleware, service } = createMiddleware();
      let context: RequestContext | undefined;

      middleware.use(createRequest(requestId), undefined, () => {
        context = service.get();
      });

      expect(context).toEqual(expect.objectContaining({ requestId: expect.stringMatching(/^[0-9a-f-]{36}$/) }));
      expect(JSON.stringify(context)).not.toContain(requestId);
    }
  );

  it("keeps temporary header context disabled in production", () => {
    process.env.NODE_ENV = "production";
    const { middleware } = createMiddleware();

    expect(() => middleware.use(createRequest("dev-req"), undefined, vi.fn())).toThrow(InvalidRequestContextError);
  });
});
