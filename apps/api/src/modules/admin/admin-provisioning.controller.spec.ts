import { describe, expect, it, vi } from "vitest";
import { AdminProvisioningController } from "./admin-provisioning.controller";
import { AdminProvisioningService } from "./admin-provisioning.service";
import { REQUIRES_ROLE_KEY } from "../../common/auth/roles.decorator";
import { ADMIN_PROVISIONING_PERMISSIONS } from "../../common/auth/permissions";
import {
  linkTenantAuth0OrgSchema,
  linkUserAuth0SubjectSchema,
  provisionMembershipSchema
} from "./admin-provisioning.dto";
import { parseRequestBody } from "../../common/validation/zod-validation";

function createServiceMock(): AdminProvisioningService {
  return {
    linkTenantAuth0Org: vi.fn().mockResolvedValue({ tenant: { id: "tenant-1", name: "Test", slug: "test", status: "ACTIVE", auth0OrgId: "org_abc" } }),
    linkUserAuth0Subject: vi.fn().mockResolvedValue({ user: { id: "user-1", email: "test@example.com", name: "Test", isActive: true, auth0UserId: "auth0|abc" } }),
    provisionMembership: vi.fn().mockResolvedValue({ membership: { id: "m-1", tenantId: "t-1", userId: "u-1", role: "OPERATOR", isActive: true, acceptedAt: new Date() } })
  } as unknown as AdminProvisioningService;
}

describe("AdminProvisioningController", () => {
  describe("@RequiresRole metadata", () => {
    it("linkTenantAuth0Org requires ADMIN or higher", () => {
      const metadata = Reflect.getMetadata(
        REQUIRES_ROLE_KEY,
        AdminProvisioningController.prototype.linkTenantAuth0Org
      );
      expect(metadata).toEqual([...ADMIN_PROVISIONING_PERMISSIONS.manage]);
    });

    it("linkUserAuth0Subject requires ADMIN or higher", () => {
      const metadata = Reflect.getMetadata(
        REQUIRES_ROLE_KEY,
        AdminProvisioningController.prototype.linkUserAuth0Subject
      );
      expect(metadata).toEqual([...ADMIN_PROVISIONING_PERMISSIONS.manage]);
    });

    it("provisionMembership requires ADMIN or higher", () => {
      const metadata = Reflect.getMetadata(
        REQUIRES_ROLE_KEY,
        AdminProvisioningController.prototype.provisionMembership
      );
      expect(metadata).toEqual([...ADMIN_PROVISIONING_PERMISSIONS.manage]);
    });
  });

  describe("service delegation", () => {
    it("linkTenantAuth0Org delegates to service with tenantId and parsed body", async () => {
      const service = createServiceMock();
      const controller = new AdminProvisioningController(service);

      await controller.linkTenantAuth0Org("tenant-1", { auth0OrgId: "org_abc" });

      expect(service.linkTenantAuth0Org).toHaveBeenCalledWith("tenant-1", "org_abc");
    });

    it("linkUserAuth0Subject delegates to service with userId and parsed body", async () => {
      const service = createServiceMock();
      const controller = new AdminProvisioningController(service);

      await controller.linkUserAuth0Subject("user-1", { auth0UserId: "auth0|abc" });

      expect(service.linkUserAuth0Subject).toHaveBeenCalledWith("user-1", "auth0|abc");
    });

    it("provisionMembership delegates to service with parsed body", async () => {
      const service = createServiceMock();
      const controller = new AdminProvisioningController(service);

      await controller.provisionMembership({ tenantId: "t-1", userId: "u-1", role: "OPERATOR" });

      expect(service.provisionMembership).toHaveBeenCalledWith({ tenantId: "t-1", userId: "u-1", role: "OPERATOR" });
    });
  });

  describe("DTO validation", () => {
    it("rejects blank auth0OrgId", () => {
      expect(() => parseRequestBody(linkTenantAuth0OrgSchema, { auth0OrgId: "" })).toThrow();
    });

    it("rejects missing auth0OrgId", () => {
      expect(() => parseRequestBody(linkTenantAuth0OrgSchema, {})).toThrow();
    });

    it("rejects blank auth0UserId", () => {
      expect(() => parseRequestBody(linkUserAuth0SubjectSchema, { auth0UserId: "" })).toThrow();
    });

    it("rejects missing auth0UserId", () => {
      expect(() => parseRequestBody(linkUserAuth0SubjectSchema, {})).toThrow();
    });

    it("rejects invalid TenantRole in membership", () => {
      expect(() =>
        parseRequestBody(provisionMembershipSchema, {
          tenantId: "t-1",
          userId: "u-1",
          role: "INVALID_ROLE"
        })
      ).toThrow();
    });

    it("rejects missing tenantId in membership", () => {
      expect(() =>
        parseRequestBody(provisionMembershipSchema, { userId: "u-1", role: "OPERATOR" })
      ).toThrow();
    });

    it("rejects missing userId in membership", () => {
      expect(() =>
        parseRequestBody(provisionMembershipSchema, { tenantId: "t-1", role: "OPERATOR" })
      ).toThrow();
    });

    it("rejects missing role in membership", () => {
      expect(() =>
        parseRequestBody(provisionMembershipSchema, { tenantId: "t-1", userId: "u-1" })
      ).toThrow();
    });

    it("accepts valid membership payload", () => {
      const result = parseRequestBody(provisionMembershipSchema, {
        tenantId: "t-1",
        userId: "u-1",
        role: "OWNER"
      });
      expect(result).toEqual({ tenantId: "t-1", userId: "u-1", role: "OWNER" });
    });

    it("accepts valid auth0OrgId", () => {
      const result = parseRequestBody(linkTenantAuth0OrgSchema, { auth0OrgId: "org_valid" });
      expect(result).toEqual({ auth0OrgId: "org_valid" });
    });

    it("accepts valid auth0UserId", () => {
      const result = parseRequestBody(linkUserAuth0SubjectSchema, { auth0UserId: "auth0|valid" });
      expect(result).toEqual({ auth0UserId: "auth0|valid" });
    });
  });
});
