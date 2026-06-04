import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { RequestContextModule } from "./common/request-context/request-context.module";
import { TemporaryHeaderRequestContextMiddleware } from "./common/request-context/request-context.middleware";
import { Auth0Module } from "./common/auth0/auth0.module";
import { Auth0JwtMiddleware } from "./common/auth0/auth0-jwt.middleware";
import { RolesGuard } from "./common/auth/roles.guard";
import { AdminModule } from "./modules/admin/admin.module";
import { AuditModule } from "./modules/audit/audit.module";
import { ContractsModule } from "./modules/contracts/contracts.module";
import { LiquidationsModule } from "./modules/liquidations/liquidations.module";
import { OwnersModule } from "./modules/owners/owners.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { PropertiesModule } from "./modules/properties/properties.module";
import { RentersModule } from "./modules/renters/renters.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { TenantsModule } from "./modules/tenants/tenants.module";

export const appModules = [
  AdminModule,
  TenantsModule,
  OwnersModule,
  RentersModule,
  PropertiesModule,
  ContractsModule,
  PaymentsModule,
  LiquidationsModule,
  ReportsModule,
  AuditModule
] as const;

const protectedRoutes = [
  "admin",
  "tenants",
  "owners",
  "renters",
  "properties",
  "contracts",
  "payments",
  "cash-movements",
  "reports",
  "liquidations"
] as const;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true
    }),
    RequestContextModule,
    Auth0Module,
    ...appModules
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RolesGuard
    }
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Auth0JwtMiddleware runs first: validates JWT, resolves tenant, populates context.
    // In non-production it falls through to TemporaryHeaderRequestContextMiddleware when
    // no Bearer token is present.
    consumer
      .apply(Auth0JwtMiddleware, TemporaryHeaderRequestContextMiddleware)
      .forRoutes(...protectedRoutes);
  }
}
