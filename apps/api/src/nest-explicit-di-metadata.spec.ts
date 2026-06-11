import { SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";
import { RolesGuard } from "./common/auth/roles.guard";
import { Auth0Guard } from "./common/auth0/auth0.guard";
import { Auth0JwtMiddleware } from "./common/auth0/auth0-jwt.middleware";
import { Auth0JwtService } from "./common/auth0/auth0-jwt.service";
import { Auth0TenantResolver } from "./common/auth0/auth0-tenant-resolver";
import { PrismaService } from "./common/prisma";
import { TemporaryHeaderRequestContextMiddleware } from "./common/request-context/request-context.middleware";
import { RequestContextService } from "./common/request-context/request-context.service";
import { DOCUMENT_STORAGE } from "./common/storage/document-storage.interface";
import { AdminProvisioningController } from "./modules/admin/admin-provisioning.controller";
import { AdminProvisioningService } from "./modules/admin/admin-provisioning.service";
import { AuditController } from "./modules/audit/audit.controller";
import { AuditService } from "./modules/audit/audit.service";
import { AuthController } from "./modules/auth/auth.controller";
import { AuthService } from "./modules/auth/auth.service";
import { ContractsController } from "./modules/contracts/contracts.controller";
import { ContractsService } from "./modules/contracts/contracts.service";
import { IndicesController } from "./modules/indices/indices.controller";
import { IndicesService } from "./modules/indices/indices.service";
import { LiquidationCalculator } from "./modules/liquidations/calculation/liquidation-calculator";
import { LiquidationsController } from "./modules/liquidations/liquidations.controller";
import { LiquidationsService } from "./modules/liquidations/liquidations.service";
import { ManualAdjustmentsController } from "./modules/liquidations/manual-adjustments.controller";
import { PDF_RENDERER } from "./modules/liquidations/pdf/pdf-renderer";
import { LiquidationStateMachine } from "./modules/liquidations/state-machine/liquidation-state-machine";
import { CashMovementsController } from "./modules/payments/cash-movements.controller";
import { PaymentsController } from "./modules/payments/payments.controller";
import { PaymentsService } from "./modules/payments/payments.service";
import { PersonasController } from "./modules/personas/personas.controller";
import { PersonasRepository } from "./modules/personas/personas.repository";
import { PropertiesController } from "./modules/properties/properties.controller";
import { PropertiesService } from "./modules/properties/properties.service";
import { ReportsController } from "./modules/reports/reports.controller";
import { ReportsService } from "./modules/reports/reports.service";
import { TenantsController } from "./modules/tenants/tenants.controller";
import { TenantsService } from "./modules/tenants/tenants.service";

type ConstructorTokenCase = Readonly<{
  subject: Function;
  tokens: readonly unknown[];
}>;

const explicitInjectionCases: readonly ConstructorTokenCase[] = [
  { subject: RolesGuard, tokens: [Reflector, RequestContextService, ConfigService] },
  { subject: Auth0Guard, tokens: [RequestContextService] },
  { subject: Auth0JwtMiddleware, tokens: [Auth0JwtService, RequestContextService, Auth0TenantResolver] },
  { subject: Auth0JwtService, tokens: [ConfigService] },
  { subject: Auth0TenantResolver, tokens: [PrismaService] },
  { subject: TemporaryHeaderRequestContextMiddleware, tokens: [RequestContextService] },
  { subject: AdminProvisioningController, tokens: [AdminProvisioningService] },
  { subject: AdminProvisioningService, tokens: [PrismaService, AuditService, RequestContextService] },
  { subject: AuditController, tokens: [AuditService] },
  { subject: AuditService, tokens: [PrismaService] },
  { subject: AuthController, tokens: [AuthService] },
  { subject: AuthService, tokens: [RequestContextService, PrismaService] },
  { subject: ContractsController, tokens: [ContractsService] },
  { subject: ContractsService, tokens: [PrismaService, RequestContextService, AuditService] },
  { subject: IndicesController, tokens: [IndicesService] },
  { subject: IndicesService, tokens: [PrismaService, RequestContextService] },
  {
    subject: LiquidationsService,
    tokens: [
      PrismaService,
      RequestContextService,
      LiquidationCalculator,
      LiquidationStateMachine,
      PDF_RENDERER,
      DOCUMENT_STORAGE,
      AuditService
    ]
  },
  { subject: LiquidationsController, tokens: [LiquidationsService] },
  { subject: ManualAdjustmentsController, tokens: [LiquidationsService] },
  { subject: PaymentsController, tokens: [PaymentsService] },
  { subject: CashMovementsController, tokens: [PaymentsService] },
  { subject: PaymentsService, tokens: [PrismaService, RequestContextService, AuditService] },
  { subject: PersonasController, tokens: [PersonasRepository] },
  { subject: PersonasRepository, tokens: [PrismaService, RequestContextService] },
  { subject: PropertiesController, tokens: [PropertiesService] },
  { subject: PropertiesService, tokens: [PrismaService, RequestContextService, AuditService] },
  { subject: ReportsController, tokens: [ReportsService] },
  { subject: ReportsService, tokens: [PrismaService, RequestContextService] },
  { subject: TenantsController, tokens: [TenantsService] },
  { subject: TenantsService, tokens: [PrismaService, AuditService, RequestContextService] }
];

function getExplicitDependencyTokens(subject: Function): Map<number, unknown> {
  const dependencies = Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, subject) as
    | Array<{ index: number; param: unknown }>
    | undefined;

  return new Map((dependencies ?? []).map(({ index, param }) => [index, param]));
}

describe("Nest explicit constructor injection metadata", () => {
  it.each(explicitInjectionCases)("declares self-described dependency tokens for $subject.name", ({ subject, tokens }) => {
    const metadata = getExplicitDependencyTokens(subject);

    const declaredTokens = tokens.map((_, index) => metadata.get(index));

    expect(declaredTokens).toEqual(tokens);
  });
});
