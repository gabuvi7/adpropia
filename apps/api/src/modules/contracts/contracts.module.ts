import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma";
import { RequestContextModule } from "../../common/request-context/request-context.module";
import { AuditModule } from "../audit/audit.module";
import { ContractsController } from "./contracts.controller";
import { ContractsService } from "./contracts.service";

@Module({ imports: [PrismaModule, RequestContextModule, AuditModule], controllers: [ContractsController], providers: [ContractsService], exports: [ContractsService] })
export class ContractsModule {}
