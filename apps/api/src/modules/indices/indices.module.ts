import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma";
import { RequestContextModule } from "../../common/request-context/request-context.module";
import { ArglyIndexProviderAdapter } from "./argly-index-provider.adapter";
import { IndicesController } from "./indices.controller";
import { INDEX_PROVIDER_ADAPTERS, IndicesService } from "./indices.service";

@Module({
  imports: [PrismaModule, RequestContextModule],
  controllers: [IndicesController],
  providers: [
    { provide: INDEX_PROVIDER_ADAPTERS, useFactory: () => [new ArglyIndexProviderAdapter(fetch)] },
    IndicesService
  ],
  exports: [IndicesService]
})
export class IndicesModule {}
