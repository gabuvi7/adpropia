import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { REQUIRES_ROLE_KEY } from "./roles.decorator";
import { CORE_ENTITY_PERMISSIONS, PAYMENTS_PERMISSIONS, CASH_MOVEMENTS_PERMISSIONS, REPORTS_PERMISSIONS, TENANTS_PERMISSIONS } from "./permissions";
import { ContractsController } from "../../modules/contracts/contracts.controller";
import { PropertiesController } from "../../modules/properties/properties.controller";
import { PaymentsController } from "../../modules/payments/payments.controller";
import { CashMovementsController } from "../../modules/payments/cash-movements.controller";
import { ReportsController } from "../../modules/reports/reports.controller";
import { TenantsController } from "../../modules/tenants/tenants.controller";
import { LiquidationsController } from "../../modules/liquidations/liquidations.controller";
import { ManualAdjustmentsController } from "../../modules/liquidations/manual-adjustments.controller";

function getMethodMetadata(controller: new (...args: never[]) => unknown, methodName: string): unknown {
  const proto = controller.prototype;
  if (!proto || typeof proto[methodName] !== "function") return undefined;
  return Reflect.getMetadata(REQUIRES_ROLE_KEY, proto[methodName]);
}

describe("ContractsController role metadata", () => {
  it("POST /contracts tiene @RequiresRole(OPERATOR)", () => {
    expect(getMethodMetadata(ContractsController, "create")).toEqual(["OPERATOR"]);
  });
  it("GET /contracts tiene @RequiresRole(READONLY)", () => {
    expect(getMethodMetadata(ContractsController, "list")).toEqual(["READONLY"]);
  });
  it("GET /contracts/active tiene @RequiresRole(READONLY)", () => {
    expect(getMethodMetadata(ContractsController, "listActive")).toEqual(["READONLY"]);
  });
  it("GET /contracts/:id tiene @RequiresRole(READONLY)", () => {
    expect(getMethodMetadata(ContractsController, "getById")).toEqual(["READONLY"]);
  });
  it("PATCH /contracts/:id tiene @RequiresRole(OPERATOR)", () => {
    expect(getMethodMetadata(ContractsController, "update")).toEqual(["OPERATOR"]);
  });
  it("PATCH /contracts/:id/status tiene @RequiresRole(ADMIN)", () => {
    expect(getMethodMetadata(ContractsController, "changeStatus")).toEqual(["ADMIN"]);
  });
});

describe("PropertiesController role metadata", () => {
  it("POST /properties tiene @RequiresRole(OPERATOR)", () => {
    expect(getMethodMetadata(PropertiesController, "create")).toEqual(["OPERATOR"]);
  });
  it("GET /properties tiene @RequiresRole(READONLY)", () => {
    expect(getMethodMetadata(PropertiesController, "list")).toEqual(["READONLY"]);
  });
  it("GET /properties/:id tiene @RequiresRole(READONLY)", () => {
    expect(getMethodMetadata(PropertiesController, "getById")).toEqual(["READONLY"]);
  });
  it("PATCH /properties/:id tiene @RequiresRole(OPERATOR)", () => {
    expect(getMethodMetadata(PropertiesController, "update")).toEqual(["OPERATOR"]);
  });
});

describe("PaymentsController role metadata", () => {
  it("POST /payments tiene @RequiresRole(OPERATOR)", () => {
    expect(getMethodMetadata(PaymentsController, "create")).toEqual(["OPERATOR"]);
  });
  it("GET /payments tiene @RequiresRole(READONLY)", () => {
    expect(getMethodMetadata(PaymentsController, "list")).toEqual(["READONLY"]);
  });
  it("GET /payments/balance tiene @RequiresRole(READONLY)", () => {
    expect(getMethodMetadata(PaymentsController, "getBalance")).toEqual(["READONLY"]);
  });
  it("GET /payments/:id tiene @RequiresRole(READONLY)", () => {
    expect(getMethodMetadata(PaymentsController, "getById")).toEqual(["READONLY"]);
  });
});

describe("CashMovementsController role metadata", () => {
  it("GET /cash-movements tiene @RequiresRole(READONLY)", () => {
    expect(getMethodMetadata(CashMovementsController, "list")).toEqual(["READONLY"]);
  });
});

describe("ReportsController role metadata", () => {
  it("GET /reports/renter-history/:renterId tiene @RequiresRole(READONLY)", () => {
    expect(getMethodMetadata(ReportsController, "getRenterHistory")).toEqual(["READONLY"]);
  });
  it("GET /reports/upcoming-due-payments tiene @RequiresRole(READONLY)", () => {
    expect(getMethodMetadata(ReportsController, "getUpcomingDuePayments")).toEqual(["READONLY"]);
  });
  it("GET /reports/cash-flow tiene @RequiresRole(READONLY)", () => {
    expect(getMethodMetadata(ReportsController, "getCashFlow")).toEqual(["READONLY"]);
  });
  it("GET /reports/outstanding-balances tiene @RequiresRole(READONLY)", () => {
    expect(getMethodMetadata(ReportsController, "getOutstandingBalances")).toEqual(["READONLY"]);
  });
});

describe("TenantsController role metadata", () => {
  it("POST /tenants tiene @RequiresRole(OWNER)", () => {
    expect(getMethodMetadata(TenantsController, "create")).toEqual(["OWNER"]);
  });
  it("GET /tenants tiene @RequiresRole(ADMIN)", () => {
    expect(getMethodMetadata(TenantsController, "list")).toEqual(["ADMIN"]);
  });
  it("GET /tenants/:id tiene @RequiresRole(ADMIN)", () => {
    expect(getMethodMetadata(TenantsController, "getById")).toEqual(["ADMIN"]);
  });
});

describe("LiquidationsController role metadata (preserved)", () => {
  it("POST /liquidations/preview requires OPERATOR or higher", () => {
    const roles = getMethodMetadata(LiquidationsController, "preview") as string[];
    expect(roles).toEqual(["OWNER", "ADMIN", "OPERATOR"]);
  });
  it("POST /liquidations requires OPERATOR or higher", () => {
    const roles = getMethodMetadata(LiquidationsController, "create") as string[];
    expect(roles).toEqual(["OWNER", "ADMIN", "OPERATOR"]);
  });
  it("PATCH /liquidations/:id/status requires OPERATOR or higher", () => {
    const roles = getMethodMetadata(LiquidationsController, "changeStatus") as string[];
    expect(roles).toEqual(["OWNER", "ADMIN", "OPERATOR"]);
  });
});

describe("ManualAdjustmentsController role metadata (preserved)", () => {
  it("POST /liquidations/:liquidationId/manual-adjustments tiene @RequiresRole(ADMIN) min", () => {
    const roles = getMethodMetadata(ManualAdjustmentsController, "add") as string[];
    expect(roles).toContain("ADMIN");
  });
  it("DELETE /liquidations/:liquidationId/manual-adjustments/:adjustmentId tiene @RequiresRole(ADMIN) min", () => {
    const roles = getMethodMetadata(ManualAdjustmentsController, "remove") as string[];
    expect(roles).toContain("ADMIN");
  });
});
