import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma";
import { RequestContextModule } from "../../common/request-context/request-context.module";
import { AuditModule } from "../audit/audit.module";
import { RentersController } from "./renters.controller";
import { RentersService } from "./renters.service";

/**
 * @deprecated Transitional legacy rental identity facade kept unregistered while
 * legacy data/backfill compatibility is retired. Public renter APIs must use the
 * Persona/contract participant boundaries instead.
 */
@Module({
  imports: [PrismaModule, RequestContextModule, AuditModule],
  controllers: [RentersController],
  providers: [RentersService],
  exports: [RentersService]
})
export class RentersModule {}
