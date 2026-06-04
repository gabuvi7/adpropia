import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma";
import { RequestContextModule } from "../../common/request-context/request-context.module";
import { AuditModule } from "../audit/audit.module";
import { AdminProvisioningController } from "./admin-provisioning.controller";
import { AdminProvisioningService } from "./admin-provisioning.service";

@Module({
  imports: [PrismaModule, RequestContextModule, AuditModule],
  controllers: [AdminProvisioningController],
  providers: [AdminProvisioningService]
})
export class AdminModule {}
