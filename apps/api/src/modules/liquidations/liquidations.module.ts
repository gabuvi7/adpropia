import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma";
import { RequestContextModule } from "../../common/request-context/request-context.module";
import { AuditModule } from "../audit/audit.module";
import { DOCUMENT_STORAGE } from "../../common/storage/document-storage.interface";
import { createDocumentStorageFromEnv } from "../../common/storage/document-storage.factory";
import { LiquidationCalculator } from "./calculation/liquidation-calculator";
import { LiquidationStateMachine } from "./state-machine/liquidation-state-machine";
import { PDF_RENDERER } from "./pdf/pdf-renderer";
import { PdfKitLiquidationRenderer } from "./pdf/pdf-renderer";
import { LiquidationsController } from "./liquidations.controller";
import { LiquidationsService } from "./liquidations.service";
import { ManualAdjustmentsController } from "./manual-adjustments.controller";

@Module({
  imports: [PrismaModule, RequestContextModule, AuditModule],
  controllers: [LiquidationsController, ManualAdjustmentsController],
  providers: [
    LiquidationsService,
    { provide: LiquidationCalculator, useFactory: () => new LiquidationCalculator() },
    { provide: LiquidationStateMachine, useFactory: () => new LiquidationStateMachine() },
    { provide: PDF_RENDERER, useFactory: () => new PdfKitLiquidationRenderer() },
    {
      provide: DOCUMENT_STORAGE,
      useFactory: () => createDocumentStorageFromEnv(process.env)
    }
  ],
  exports: [LiquidationsService]
})
export class LiquidationsModule {}
