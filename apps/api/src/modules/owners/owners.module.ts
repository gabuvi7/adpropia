import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma";
import { RequestContextModule } from "../../common/request-context/request-context.module";
import { AuditModule } from "../audit/audit.module";
import { OwnersController } from "./owners.controller";
import { OwnersService } from "./owners.service";

/**
 * @deprecated Transitional legacy rental identity facade kept unregistered while
 * legacy data/backfill compatibility is retired. Public owner APIs must use the
 * Persona/property ownership boundaries instead.
 */
@Module({
  imports: [PrismaModule, RequestContextModule, AuditModule],
  controllers: [OwnersController],
  providers: [OwnersService],
  exports: [OwnersService]
})
export class OwnersModule {}
