import { Controller, Get, Inject, Query } from "@nestjs/common";
import { RequiresRole } from "../../common/auth/roles.decorator";
import { CASH_MOVEMENTS_PERMISSIONS } from "../../common/auth/permissions";
import { parseRequestBody } from "../../common/validation/zod-validation";
import { listCashMovementsQuerySchema } from "./payments.dto";
import { PaymentsService } from "./payments.service";

@Controller("cash-movements")
export class CashMovementsController {
  constructor(@Inject(PaymentsService) private readonly paymentsService: PaymentsService) {}

  @Get()
  @RequiresRole(...CASH_MOVEMENTS_PERMISSIONS.list)
  list(@Query() query: unknown) {
    return this.paymentsService.listCashMovements(parseRequestBody(listCashMovementsQuerySchema, query));
}
}
