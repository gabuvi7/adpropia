import "reflect-metadata";
import { SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants";
import { describe, expect, it } from "vitest";
import { TemporaryHeaderRequestContextMiddleware } from "./request-context.middleware";
import { RequestContextService } from "./request-context.service";

describe("TemporaryHeaderRequestContextMiddleware", () => {
  it("declares explicit RequestContextService injection token", () => {
    const dependencies = Reflect.getMetadata(
      SELF_DECLARED_DEPS_METADATA,
      TemporaryHeaderRequestContextMiddleware
    ) as Array<{ index: number; param: unknown }>;

    expect(dependencies).toEqual(expect.arrayContaining([{ index: 0, param: RequestContextService }]));
  });
});
