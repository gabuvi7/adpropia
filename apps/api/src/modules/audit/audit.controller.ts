import { Controller, Get, Query } from "@nestjs/common";
import { AUDIT_LOG_PERMISSIONS } from "../../common/auth/permissions";
import { RequiresRole } from "../../common/auth/roles.decorator";
import { parseAuditLogQuery } from "./audit.dto";
import { AuditService } from "./audit.service";

@Controller("audit-logs")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequiresRole(...AUDIT_LOG_PERMISSIONS.read)
  list(@Query() query: unknown) {
    return this.auditService.listAuditLogs(parseAuditLogQuery(query));
  }
}
