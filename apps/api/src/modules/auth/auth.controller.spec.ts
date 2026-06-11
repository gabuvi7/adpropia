import { describe, expect, it, vi } from "vitest";
import { SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants";
import { AuthController } from "./auth.controller";
import type { AuthBootstrap } from "./auth.service";
import { AuthService } from "./auth.service";

function createServiceMock(bootstrap?: AuthBootstrap): AuthService {
  return {
    getBootstrap: vi.fn().mockResolvedValue(
      bootstrap ?? { userId: "user-1", tenantId: "tenant-1", tenantName: "Test Agency", role: "ADMIN" },
    ),
  } as unknown as AuthService;
}

describe("AuthController", () => {
  it("declares explicit AuthService injection token", () => {
    const dependencies = Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, AuthController) as Array<{
      index: number;
      param: unknown;
    }>;

    expect(dependencies).toEqual(expect.arrayContaining([{ index: 0, param: AuthService }]));
  });

  it("responds with bootstrap data from GET /auth/me", async () => {
    const service = createServiceMock();
    const controller = new AuthController(service);

    const result = await controller.me();

    expect(result).toEqual({
      userId: "user-1",
      tenantId: "tenant-1",
      tenantName: "Test Agency",
      role: "ADMIN",
    });
    expect(service.getBootstrap).toHaveBeenCalledOnce();
  });

  it("returns different role from service output", async () => {
    const service = createServiceMock({ userId: "u-2", tenantId: "t-2", tenantName: "Other Agency", role: "READONLY" });
    const controller = new AuthController(service);

    const result = await controller.me();

    expect(result).toEqual({
      userId: "u-2",
      tenantId: "t-2",
      tenantName: "Other Agency",
      role: "READONLY",
    });
  });

  it("propagates service errors", async () => {
    const service = { getBootstrap: vi.fn().mockRejectedValue(new Error("Bootstrap failed")) } as unknown as AuthService;
    const controller = new AuthController(service);

    await expect(controller.me()).rejects.toThrow("Bootstrap failed");
  });
});
