import { BadRequestException, ForbiddenException, type ExecutionContext } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import { AUDIT_LOG_PERMISSIONS } from "../../common/auth/permissions";
import { REQUIRES_ROLE_KEY } from "../../common/auth/roles.decorator";
import { AUTH_ROLE_ENFORCEMENT_KEY, RolesGuard } from "../../common/auth/roles.guard";
import type { RequestContextService } from "../../common/request-context/request-context.service";
import { AuditController } from "./audit.controller";
import type { AuditService } from "./audit.service";

function createAuditServiceMock(): AuditService {
  return {
    listAuditLogs: vi.fn().mockResolvedValue({
      items: [
        {
          id: "audit-1",
          tenantId: "tenant-1",
          userId: "user-1",
          requestId: "req-1",
          entityType: "contract",
          entityId: "contract-1",
          action: "contract.created",
          metadata: { status: "DRAFT" },
          createdAt: new Date("2026-06-05T12:00:00.000Z")
        }
      ],
      page: 1,
      pageSize: 50,
      total: 1
    })
  } as unknown as AuditService;
}

function createGuardForRole(role: "SUPERADMIN" | "OWNER" | "ADMIN" | "OPERATOR" | "READONLY") {
  const reflector = new Reflector();
  const contextService = {
    getOptional: vi.fn().mockReturnValue({
      tenantId: role === "SUPERADMIN" ? "platform" : "tenant-1",
      userId: `user-${role.toLowerCase()}`,
      requestId: "req-1",
      role
    })
  } as unknown as RequestContextService;
  const config = {
    get: vi.fn((key: string) => (key === AUTH_ROLE_ENFORCEMENT_KEY ? "true" : undefined))
  } as unknown as ConfigService;

  return new RolesGuard(reflector, contextService, config);
}

function createExecutionContext(): ExecutionContext {
  return {
    getHandler: () => AuditController.prototype.list,
    getClass: () => AuditController,
    switchToHttp: () => ({
      getRequest: () => ({ method: "GET", url: "/audit-logs" })
    })
  } as unknown as ExecutionContext;
}

describe("AuditController", () => {
  it("returns paginated business audit logs for SUPERADMIN callers", async () => {
    const auditService = createAuditServiceMock();
    const controller = new AuditController(auditService);
    const guard = createGuardForRole("SUPERADMIN");

    const allowed = guard.canActivate(createExecutionContext());
    const result = await controller.list({ entityType: "contract", action: "contract.created" });

    expect(allowed).toBe(true);
    expect(auditService.listAuditLogs).toHaveBeenCalledWith({
      entityType: "contract",
      action: "contract.created",
      page: 1,
      pageSize: 50
    });
    expect(result).toEqual({
      items: [
        expect.objectContaining({
          id: "audit-1",
          entityType: "contract",
          action: "contract.created"
        })
      ],
      page: 1,
      pageSize: 50,
      total: 1
    });
  });

  it("coerces pagination and date query values before calling the service", async () => {
    const auditService = createAuditServiceMock();
    const controller = new AuditController(auditService);

    await controller.list({
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-06-05T23:59:59.999Z",
      page: "3",
      pageSize: "10"
    });

    expect(auditService.listAuditLogs).toHaveBeenCalledWith({
      from: new Date("2026-06-01T00:00:00.000Z"),
      to: new Date("2026-06-05T23:59:59.999Z"),
      page: 3,
      pageSize: 10
    });
  });

  it("rejects invalid query bounds before calling the service", async () => {
    const auditService = createAuditServiceMock();
    const controller = new AuditController(auditService);

    expect(() => controller.list({ pageSize: "101" })).toThrow(BadRequestException);
    expect(auditService.listAuditLogs).not.toHaveBeenCalled();
  });

  it.each(["OWNER", "ADMIN", "OPERATOR", "READONLY"] as const)(
    "denies %s callers before audit logs are read",
    (role) => {
      const auditService = createAuditServiceMock();
      const guard = createGuardForRole(role);

      expect(Reflect.getMetadata(REQUIRES_ROLE_KEY, AuditController.prototype.list)).toEqual(
        AUDIT_LOG_PERMISSIONS.read
      );
      expect(() => guard.canActivate(createExecutionContext())).toThrow(ForbiddenException);
      expect(auditService.listAuditLogs).not.toHaveBeenCalled();
    }
  );
});
