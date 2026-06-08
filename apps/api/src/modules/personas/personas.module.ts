import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma";
import { RequestContextModule } from "../../common/request-context/request-context.module";
import { PersonasController } from "./personas.controller";
import { PersonasRepository } from "./personas.repository";

@Module({
  imports: [PrismaModule, RequestContextModule],
  controllers: [PersonasController],
  providers: [PersonasRepository],
  exports: [PersonasRepository]
})
export class PersonasModule {}
