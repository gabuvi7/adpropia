import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { RequiresRole } from "../../common/auth/roles.decorator";
import { PAYMENTS_PERMISSIONS } from "../../common/auth/permissions";
import { parseRequestBody } from "../../common/validation/zod-validation";
import { balanceQuerySchema, createPaymentSchema, listPaymentsQuerySchema } from "./payments.dto";
import { PaymentsService } from "./payments.service";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @RequiresRole(...PAYMENTS_PERMISSIONS.create)
  create(@Body() body: unknown) {
    return this.paymentsService.createPayment(parseRequestBody(createPaymentSchema, body));
}

  @Get()
  @RequiresRole(...PAYMENTS_PERMISSIONS.list)
  list(@Query() query: unknown) {
    return this.paymentsService.listPayments(parseRequestBody(listPaymentsQuerySchema, query));
  }

  @Get("balance")
  @RequiresRole(...PAYMENTS_PERMISSIONS.balance)
  getBalance(@Query() query: unknown) {
    const parsed = parseRequestBody(balanceQuerySchema, query);
    return this.paymentsService.getContractBalance(parsed.contractId);
  }

  @Get(":id")
  @RequiresRole(...PAYMENTS_PERMISSIONS.read)
  getById(@Param("id") id: string) {
    return this.paymentsService.getPaymentById(id);
  }
}
