import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SentryGlobalFilter } from "@sentry/nestjs/setup";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { RequestContextModule } from "./common/request-context/request-context.module";
import { TemporaryHeaderRequestContextMiddleware } from "./common/request-context/request-context.middleware";
import { RequestLoggingModule } from "./common/request-logging/request-logging.module";
import { RequestLoggingMiddleware } from "./common/request-logging/request-logging.middleware";
import { Auth0Module } from "./common/auth0/auth0.module";
import { Auth0JwtMiddleware } from "./common/auth0/auth0-jwt.middleware";
import { RolesGuard } from "./common/auth/roles.guard";
import { AdminModule } from "./modules/admin/admin.module";
import { AuditModule } from "./modules/audit/audit.module";
import { ContractsModule } from "./modules/contracts/contracts.module";
import { LiquidationsModule } from "./modules/liquidations/liquidations.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { PersonasModule } from "./modules/personas/personas.module";
import { PropertiesModule } from "./modules/properties/properties.module";
import { IndicesModule } from "./modules/indices/indices.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { TenantsModule } from "./modules/tenants/tenants.module";
import { AuthModule } from "./modules/auth/auth.module";
import { AccessRequestsModule } from "./modules/access-requests/access-requests.module";

export const appModules = [
  AccessRequestsModule,
  AdminModule,
  TenantsModule,
  PersonasModule,
  PropertiesModule,
  ContractsModule,
  PaymentsModule,
  IndicesModule,
  LiquidationsModule,
  ReportsModule,
  AuditModule,
  AuthModule
] as const;

export const protectedRoutes = [
  "admin",
  "tenants",
  "personas",
  "properties",
  "contracts",
  "payments",
  "cash-movements",
  "indices",
  "audit-logs",
  "reports",
  "liquidations",
  "auth"
] as const;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true
    }),
    RequestContextModule,
    RequestLoggingModule,
    Auth0Module,
    ...appModules
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter
    },
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

    consumer.apply(RequestLoggingMiddleware).forRoutes("*");
  }
}
