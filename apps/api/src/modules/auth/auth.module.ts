import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma";
import { RequestContextModule } from "../../common/request-context/request-context.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  imports: [PrismaModule, RequestContextModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
