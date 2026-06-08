import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma";
import { RequestContextModule } from "../../common/request-context/request-context.module";
import { IndicesController } from "./indices.controller";
import { IndicesService } from "./indices.service";

@Module({
  imports: [PrismaModule, RequestContextModule],
  controllers: [IndicesController],
  providers: [IndicesService],
  exports: [IndicesService]
})
export class IndicesModule {}
