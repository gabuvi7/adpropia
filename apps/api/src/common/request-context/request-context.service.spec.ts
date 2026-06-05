import { describe, expect, it } from "vitest";
import { RequestContextService, InvalidRequestContextError } from "./request-context.service";

describe("RequestContextService", () => {
  describe("fromTemporaryHeaders", () => {
    it("accepts SUPERADMIN role from x-role header", () => {
      const service = new RequestContextService();
      const result = service.fromTemporaryHeaders({
        "x-tenant-id": "tenant-1",
        "x-role": "SUPERADMIN",
        "x-user-id": "super-user",
        "x-request-id": "req-1"
      });

      expect(result.role).toBe("SUPERADMIN");
      expect(result.tenantId).toBe("tenant-1");
      expect(result.userId).toBe("super-user");
    });

    it("normalizes lowercase 'superadmin' from x-role header to uppercase", () => {
      const service = new RequestContextService();
      const result = service.fromTemporaryHeaders({
        "x-tenant-id": "tenant-1",
        "x-role": "superadmin",
        "x-user-id": "super-user",
        "x-request-id": "req-1"
      });

      expect(result.role).toBe("SUPERADMIN");
    });

    it("rejects unknown role with InvalidRequestContextError", () => {
      const service = new RequestContextService();
      expect(() =>
        service.fromTemporaryHeaders({
          "x-tenant-id": "tenant-1",
          "x-role": "UNKNOWN_ROLE",
          "x-user-id": "user-1"
        })
      ).toThrow(InvalidRequestContextError);
    });
  });

  describe("fromJwtResolution", () => {
    it("maps SUPERADMIN resolution to request context", () => {
      const service = new RequestContextService();
      const result = service.fromJwtResolution(
        { userId: "super-user", tenantId: "tenant-1", role: "SUPERADMIN" },
        "req-1"
      );

      expect(result).toEqual({
        requestId: "req-1",
        userId: "super-user",
        tenantId: "tenant-1",
        role: "SUPERADMIN"
      });
    });
  });
});
