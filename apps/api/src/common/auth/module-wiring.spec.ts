import "reflect-metadata";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AppModule, appModules, protectedRoutes } from "../../app.module";
import { LiquidationsModule } from "../../modules/liquidations/liquidations.module";
import {
  ADMIN_PROVISIONING_PERMISSIONS,
  AUDIT_LOG_PERMISSIONS,
  CORE_ENTITY_PERMISSIONS,
  PAYMENTS_PERMISSIONS,
  CASH_MOVEMENTS_PERMISSIONS,
  REPORTS_PERMISSIONS,
  TENANTS_PERMISSIONS
} from "./permissions";
import { REQUIRES_ROLE_KEY } from "./roles.decorator";
import { AdminProvisioningController } from "../../modules/admin/admin-provisioning.controller";
import { AuditController } from "../../modules/audit/audit.controller";
import { ContractsController } from "../../modules/contracts/contracts.controller";
import { PropertiesController } from "../../modules/properties/properties.controller";
import { PaymentsController } from "../../modules/payments/payments.controller";
import { CashMovementsController } from "../../modules/payments/cash-movements.controller";
import { ReportsController } from "../../modules/reports/reports.controller";
import { TenantsController } from "../../modules/tenants/tenants.controller";

const currentDir = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(currentDir, "../../..");

describe("Module wiring", () => {
  it("AppModule declares APP_GUARD in its providers", () => {
    const providers: unknown[] = Reflect.getMetadata("providers", AppModule) ?? [];
    const appGuardProvider = providers.find(
      (p: unknown) =>
        typeof p === "object" &&
        p !== null &&
        "provide" in (p as Record<string, unknown>) &&
        (p as Record<string, unknown>).provide === "APP_GUARD"
    );
    expect(appGuardProvider).toBeDefined();
  });

  it("LiquidationsModule does NOT declare APP_GUARD in its providers", () => {
    const providers: unknown[] = Reflect.getMetadata("providers", LiquidationsModule) ?? [];
    const appGuardProvider = providers.find(
      (p: unknown) =>
        typeof p === "object" &&
        p !== null &&
        "provide" in (p as Record<string, unknown>) &&
        (p as Record<string, unknown>).provide === "APP_GUARD"
    );
    expect(appGuardProvider).toBeUndefined();
  });

  it("does not expose legacy owner/renter rental API modules as public application modules", () => {
    expect(appModules.map((moduleRef) => moduleRef.name)).not.toEqual(expect.arrayContaining(["OwnersModule", "RentersModule"]));
  });

  it("keeps active rental modules wired while excluding legacy owner/renter modules from AppModule imports", () => {
    const imports: unknown[] = Reflect.getMetadata("imports", AppModule) ?? [];
    const importNames = imports.map((moduleRef) => (typeof moduleRef === "function" ? moduleRef.name : String(moduleRef)));

    expect(importNames).toEqual(expect.arrayContaining(["PropertiesModule", "ContractsModule", "PaymentsModule"]));
    expect(importNames).not.toEqual(expect.arrayContaining(["OwnersModule", "RentersModule"]));
  });

  it("does not protect legacy owner/renter routes because those public facades are removed", () => {
    expect([...protectedRoutes]).not.toEqual(expect.arrayContaining(["owners", "renters"]));
  });

  it("keeps active rental routes protected while excluding legacy owner/renter route names", () => {
    expect([...protectedRoutes]).toEqual(expect.arrayContaining(["properties", "contracts", "payments"]));
    expect([...protectedRoutes]).not.toEqual(expect.arrayContaining(["owners", "renters"]));
  });

  it("removes deprecated legacy owner/renter internals once they are no longer active imports", () => {
    const deprecatedLegacyFiles = [
      "src/modules/owners/owners.controller.ts",
      "src/modules/owners/owners.dto.ts",
      "src/modules/owners/owners.module.ts",
      "src/modules/owners/owners.service.ts",
      "src/modules/owners/owners.service.spec.ts",
      "src/modules/renters/renters.controller.ts",
      "src/modules/renters/renters.dto.ts",
      "src/modules/renters/renters.module.ts",
      "src/modules/renters/renters.service.ts",
      "src/modules/renters/renters.service.spec.ts"
    ];

    expect(deprecatedLegacyFiles.filter((filePath) => existsSync(resolve(apiRoot, filePath)))).toEqual([]);
  });

  it("keeps destructive legacy owner/renter database removal outside the API cleanup boundary", () => {
    const deletedApiFiles = [
      "src/modules/owners/owners.module.ts",
      "src/modules/renters/renters.module.ts"
    ];

    expect(deletedApiFiles.some((filePath) => existsSync(resolve(apiRoot, filePath)))).toBe(false);
    expect(appModules.map((moduleRef) => moduleRef.name)).not.toEqual(expect.arrayContaining(["OwnersModule", "RentersModule"]));
  });
});

describe("@RequiresRole metadata inventory", () => {
  describe("ContractsController", () => {
    it("create → CORE_ENTITY_PERMISSIONS.create", () => {
      expect(Reflect.getMetadata(REQUIRES_ROLE_KEY, ContractsController.prototype.create))
        .toEqual([...CORE_ENTITY_PERMISSIONS.create]);
    });

    it("list → CORE_ENTITY_PERMISSIONS.list", () => {
      expect(Reflect.getMetadata(REQUIRES_ROLE_KEY, ContractsController.prototype.list))
        .toEqual([...CORE_ENTITY_PERMISSIONS.list]);
    });

    it("listActive → CORE_ENTITY_PERMISSIONS.list", () => {
      expect(Reflect.getMetadata(REQUIRES_ROLE_KEY, ContractsController.prototype.listActive))
        .toEqual([...CORE_ENTITY_PERMISSIONS.list]);
    });

    it("getById → CORE_ENTITY_PERMISSIONS.read", () => {
      expect(Reflect.getMetadata(REQUIRES_ROLE_KEY, ContractsController.prototype.getById))
        .toEqual([...CORE_ENTITY_PERMISSIONS.read]);
    });

    it("update → CORE_ENTITY_PERMISSIONS.update", () => {
      expect(Reflect.getMetadata(REQUIRES_ROLE_KEY, ContractsController.prototype.update))
        .toEqual([...CORE_ENTITY_PERMISSIONS.update]);
    });

    it("changeStatus → [ADMIN]", () => {
      expect(Reflect.getMetadata(REQUIRES_ROLE_KEY, ContractsController.prototype.changeStatus))
        .toEqual(["ADMIN"]);
    });
  });

  describe("PropertiesController", () => {
    it("create → CORE_ENTITY_PERMISSIONS.create", () => {
      expect(Reflect.getMetadata(REQUIRES_ROLE_KEY, PropertiesController.prototype.create))
        .toEqual([...CORE_ENTITY_PERMISSIONS.create]);
    });

    it("list → CORE_ENTITY_PERMISSIONS.list", () => {
      expect(Reflect.getMetadata(REQUIRES_ROLE_KEY, PropertiesController.prototype.list))
        .toEqual([...CORE_ENTITY_PERMISSIONS.list]);
    });

    it("getById → CORE_ENTITY_PERMISSIONS.read", () => {
      expect(Reflect.getMetadata(REQUIRES_ROLE_KEY, PropertiesController.prototype.getById))
        .toEqual([...CORE_ENTITY_PERMISSIONS.read]);
    });

    it("update → CORE_ENTITY_PERMISSIONS.update", () => {
      expect(Reflect.getMetadata(REQUIRES_ROLE_KEY, PropertiesController.prototype.update))
        .toEqual([...CORE_ENTITY_PERMISSIONS.update]);
    });
  });

  describe("PaymentsController", () => {
    it("create → PAYMENTS_PERMISSIONS.create", () => {
      expect(Reflect.getMetadata(REQUIRES_ROLE_KEY, PaymentsController.prototype.create))
        .toEqual([...PAYMENTS_PERMISSIONS.create]);
    });

    it("list → PAYMENTS_PERMISSIONS.list", () => {
      expect(Reflect.getMetadata(REQUIRES_ROLE_KEY, PaymentsController.prototype.list))
        .toEqual([...PAYMENTS_PERMISSIONS.list]);
    });

    it("getBalance → PAYMENTS_PERMISSIONS.balance", () => {
      expect(Reflect.getMetadata(REQUIRES_ROLE_KEY, PaymentsController.prototype.getBalance))
        .toEqual([...PAYMENTS_PERMISSIONS.balance]);
    });

    it("getById → PAYMENTS_PERMISSIONS.read", () => {
      expect(Reflect.getMetadata(REQUIRES_ROLE_KEY, PaymentsController.prototype.getById))
        .toEqual([...PAYMENTS_PERMISSIONS.read]);
    });
  });

  describe("CashMovementsController", () => {
    it("list → CASH_MOVEMENTS_PERMISSIONS.list", () => {
      expect(Reflect.getMetadata(REQUIRES_ROLE_KEY, CashMovementsController.prototype.list))
        .toEqual([...CASH_MOVEMENTS_PERMISSIONS.list]);
    });
  });

  describe("ReportsController", () => {
    it("getRenterHistory → REPORTS_PERMISSIONS.renterHistory", () => {
      expect(Reflect.getMetadata(REQUIRES_ROLE_KEY, ReportsController.prototype.getRenterHistory))
        .toEqual([...REPORTS_PERMISSIONS.renterHistory]);
    });

    it("getUpcomingDuePayments → REPORTS_PERMISSIONS.upcomingDuePayments", () => {
      expect(Reflect.getMetadata(REQUIRES_ROLE_KEY, ReportsController.prototype.getUpcomingDuePayments))
        .toEqual([...REPORTS_PERMISSIONS.upcomingDuePayments]);
    });

    it("getCashFlow → REPORTS_PERMISSIONS.cashFlow", () => {
      expect(Reflect.getMetadata(REQUIRES_ROLE_KEY, ReportsController.prototype.getCashFlow))
        .toEqual([...REPORTS_PERMISSIONS.cashFlow]);
    });

    it("getOutstandingBalances → REPORTS_PERMISSIONS.outstandingBalances", () => {
      expect(Reflect.getMetadata(REQUIRES_ROLE_KEY, ReportsController.prototype.getOutstandingBalances))
        .toEqual([...REPORTS_PERMISSIONS.outstandingBalances]);
    });
  });

  describe("AuditController", () => {
    it("list → AUDIT_LOG_PERMISSIONS.read", () => {
      expect(Reflect.getMetadata(REQUIRES_ROLE_KEY, AuditController.prototype.list))
        .toEqual([...AUDIT_LOG_PERMISSIONS.read]);
    });
  });

  describe("TenantsController", () => {
    it("create → TENANTS_PERMISSIONS.create", () => {
      expect(Reflect.getMetadata(REQUIRES_ROLE_KEY, TenantsController.prototype.create))
        .toEqual([...TENANTS_PERMISSIONS.create]);
    });

    it("list → TENANTS_PERMISSIONS.list", () => {
      expect(Reflect.getMetadata(REQUIRES_ROLE_KEY, TenantsController.prototype.list))
        .toEqual([...TENANTS_PERMISSIONS.list]);
    });

    it("getById → TENANTS_PERMISSIONS.read", () => {
      expect(Reflect.getMetadata(REQUIRES_ROLE_KEY, TenantsController.prototype.getById))
        .toEqual([...TENANTS_PERMISSIONS.read]);
    });
  });

  describe("AdminProvisioningController", () => {
    it("linkTenantAuth0Org → ADMIN_PROVISIONING_PERMISSIONS.manage", () => {
      expect(Reflect.getMetadata(REQUIRES_ROLE_KEY, AdminProvisioningController.prototype.linkTenantAuth0Org))
        .toEqual([...ADMIN_PROVISIONING_PERMISSIONS.manage]);
    });

    it("linkUserAuth0Subject → ADMIN_PROVISIONING_PERMISSIONS.manage", () => {
      expect(Reflect.getMetadata(REQUIRES_ROLE_KEY, AdminProvisioningController.prototype.linkUserAuth0Subject))
        .toEqual([...ADMIN_PROVISIONING_PERMISSIONS.manage]);
    });

    it("provisionMembership → ADMIN_PROVISIONING_PERMISSIONS.manage", () => {
      expect(Reflect.getMetadata(REQUIRES_ROLE_KEY, AdminProvisioningController.prototype.provisionMembership))
        .toEqual([...ADMIN_PROVISIONING_PERMISSIONS.manage]);
    });
  });
});
