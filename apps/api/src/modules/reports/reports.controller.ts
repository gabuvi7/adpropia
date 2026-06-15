import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { RequiresRole } from "../../common/auth/roles.decorator";
import { REPORTS_PERMISSIONS } from "../../common/auth/permissions";
import { parseRequestBody } from "../../common/validation/zod-validation";
import {
  cashFlowQuerySchema,
  outstandingBalancesQuerySchema,
  renterHistoryParamsSchema,
  upcomingAdjustmentsQuerySchema,
  upcomingDuePaymentsQuerySchema
} from "./reports.dto";
import { ReportsService } from "./reports.service";

@Controller("reports")
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reportsService: ReportsService) {}

  @Get("renter-history/:renterId")
  @RequiresRole(...REPORTS_PERMISSIONS.renterHistory)
  getRenterHistory(@Param("renterId") renterId: string) {
    const parsed = parseRequestBody(renterHistoryParamsSchema, { renterId });
    return this.reportsService.getRenterHistory(parsed.renterId);
  }

  @Get("upcoming-due-payments")
  @RequiresRole(...REPORTS_PERMISSIONS.upcomingDuePayments)
  getUpcomingDuePayments(@Query() query: unknown) {
    return this.reportsService.getUpcomingDuePayments(parseRequestBody(upcomingDuePaymentsQuerySchema, query));
  }

  @Get("cash-flow")
  @RequiresRole(...REPORTS_PERMISSIONS.cashFlow)
  getCashFlow(@Query() query: unknown) {
    return this.reportsService.getCashFlow(parseRequestBody(cashFlowQuerySchema, query));
  }

  @Get("outstanding-balances")
  @RequiresRole(...REPORTS_PERMISSIONS.outstandingBalances)
  getOutstandingBalances(@Query() query: unknown) {
    return this.reportsService.getOutstandingBalances(parseRequestBody(outstandingBalancesQuerySchema, query));
  }

  @Get("upcoming-adjustments")
  @RequiresRole(...REPORTS_PERMISSIONS.upcomingAdjustments)
  getUpcomingAdjustments(@Query() query: unknown) {
    return this.reportsService.getUpcomingAdjustments(parseRequestBody(upcomingAdjustmentsQuerySchema, query));
  }
}
