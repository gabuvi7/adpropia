import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma";
import { RequestContextModule } from "../../common/request-context/request-context.module";
import { AuditModule } from "../audit/audit.module";
import { RentersController } from "./renters.controller";
import { RentersService } from "./renters.service";

@Module({
  imports: [PrismaModule, RequestContextModule, AuditModule],
  controllers: [RentersController],
  providers: [RentersService],
  exports: [RentersService]
})
export class RentersModule {}
