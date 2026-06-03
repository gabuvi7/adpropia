import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { RequestContextModule } from "../request-context/request-context.module";
import { Auth0JwtMiddleware } from "./auth0-jwt.middleware";
import { Auth0JwtService } from "./auth0-jwt.service";
import { Auth0TenantResolver } from "./auth0-tenant-resolver";
import { Auth0Guard } from "./auth0.guard";

@Module({
  imports: [PrismaModule, RequestContextModule],
  providers: [
    Auth0JwtService,
    Auth0JwtMiddleware,
    Auth0TenantResolver,
    Auth0Guard
  ],
  exports: [
    Auth0JwtService,
    Auth0JwtMiddleware,
    Auth0TenantResolver,
    Auth0Guard
  ]
})
export class Auth0Module {}
