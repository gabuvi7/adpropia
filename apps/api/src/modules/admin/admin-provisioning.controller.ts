import { Body, Controller, Inject, Param, Post } from "@nestjs/common";
import { RequiresRole } from "../../common/auth/roles.decorator";
import { ADMIN_PROVISIONING_PERMISSIONS } from "../../common/auth/permissions";
import { parseRequestBody } from "../../common/validation/zod-validation";
import {
  linkTenantAuth0OrgSchema,
  linkUserAuth0SubjectSchema,
  provisionMembershipSchema
} from "./admin-provisioning.dto";
import { AdminProvisioningService } from "./admin-provisioning.service";

@Controller("admin/provisioning")
export class AdminProvisioningController {
  constructor(@Inject(AdminProvisioningService) private readonly service: AdminProvisioningService) {}

  @Post("tenants/:tenantId/auth0-org")
  @RequiresRole(...ADMIN_PROVISIONING_PERMISSIONS.manage)
  linkTenantAuth0Org(@Param("tenantId") tenantId: string, @Body() body: unknown) {
    const { auth0OrgId } = parseRequestBody(linkTenantAuth0OrgSchema, body);
    return this.service.linkTenantAuth0Org(tenantId, auth0OrgId);
  }

  @Post("users/:userId/auth0-subject")
  @RequiresRole(...ADMIN_PROVISIONING_PERMISSIONS.manage)
  linkUserAuth0Subject(@Param("userId") userId: string, @Body() body: unknown) {
    const { auth0UserId } = parseRequestBody(linkUserAuth0SubjectSchema, body);
    return this.service.linkUserAuth0Subject(userId, auth0UserId);
  }

  @Post("memberships")
  @RequiresRole(...ADMIN_PROVISIONING_PERMISSIONS.manage)
  provisionMembership(@Body() body: unknown) {
    return this.service.provisionMembership(parseRequestBody(provisionMembershipSchema, body));
  }
}
