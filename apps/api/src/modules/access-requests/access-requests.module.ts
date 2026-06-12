import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import { PrismaModule } from "../../common/prisma";
import { AccessRequestsController } from "./access-requests.controller";
import { AccessRequestsService } from "./access-requests.service";
import { ACCESS_REQUESTS_FETCH, RESEND_CLIENT } from "./access-requests.tokens";

@Module({
  imports: [PrismaModule],
  controllers: [AccessRequestsController],
  providers: [
    AccessRequestsService,
    {
      provide: RESEND_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new Resend(config.get<string>("RESEND_API_KEY"))
    },
    {
      provide: ACCESS_REQUESTS_FETCH,
      useValue: fetch
    }
  ]
})
export class AccessRequestsModule {}
