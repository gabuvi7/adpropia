import { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import { IS_PUBLIC_KEY } from "../../common/auth/public.decorator";
import { AccessRequestsController } from "./access-requests.controller";

describe("AccessRequestsController", () => {
  it("marks POST /access-requests as public", () => {
    const reflector = new Reflector();

    expect(reflector.get(IS_PUBLIC_KEY, AccessRequestsController.prototype.create)).toBe(true);
  });

  it("validates the request body before submitting it to the service", async () => {
    const service = { submit: vi.fn() };
    const controller = new AccessRequestsController(service as never);

    expect(() => controller.create({ companyName: "missing fields" })).toThrow();
    expect(service.submit).not.toHaveBeenCalled();
  });
});
