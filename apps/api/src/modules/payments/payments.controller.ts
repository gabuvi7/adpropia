import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { RequiresRole } from "../../common/auth/roles.decorator";
import { PAYMENTS_PERMISSIONS } from "../../common/auth/permissions";
import { parseRequestBody } from "../../common/validation/zod-validation";
import { balanceQuerySchema, createPaymentSchema, listPaymentsQuerySchema, recordRentPaymentSchema, recordTenantBalanceMovementSchema } from "./payments.dto";
import { PaymentsService } from "./payments.service";

@Controller("payments")
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly paymentsService: PaymentsService) {}

  @Post()
  @RequiresRole(...PAYMENTS_PERMISSIONS.create)
  create(@Body() body: unknown) {
    return this.paymentsService.createPayment(parseRequestBody(createPaymentSchema, body));
  }

  @Post("rent-payments")
  @RequiresRole(...PAYMENTS_PERMISSIONS.create)
  recordRentPayment(@Body() body: unknown) {
    return this.paymentsService.recordRentPayment(parseRequestBody(recordRentPaymentSchema, body));
  }

  @Post("tenant-balance-movements")
  @RequiresRole(...PAYMENTS_PERMISSIONS.create)
  recordTenantBalanceMovement(@Body() body: unknown) {
    return this.paymentsService.recordTenantBalanceMovement(parseRequestBody(recordTenantBalanceMovementSchema, body));
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
