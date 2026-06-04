import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma";
import { AdminProvisioningController } from "./admin-provisioning.controller";
import { AdminProvisioningService } from "./admin-provisioning.service";

@Module({
  imports: [PrismaModule],
  controllers: [AdminProvisioningController],
  providers: [AdminProvisioningService]
})
export class AdminModule {}
