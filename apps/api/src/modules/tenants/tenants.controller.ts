import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { RequiresRole } from "../../common/auth/roles.decorator";
import { TENANTS_PERMISSIONS } from "../../common/auth/permissions";
import { parseRequestBody } from "../../common/validation/zod-validation";
import { createTenantSchema } from "./tenants.dto";
import { TenantsService } from "./tenants.service";

@Controller("tenants")
export class TenantsController {
  constructor(@Inject(TenantsService) private readonly tenantsService: TenantsService) {}

  @Post()
  @RequiresRole(...TENANTS_PERMISSIONS.create)
  create(@Body() body: unknown) {
    return this.tenantsService.createTenant(parseRequestBody(createTenantSchema, body));
}

  @Get()
  @RequiresRole(...TENANTS_PERMISSIONS.list)
  list() {
    return this.tenantsService.listTenants();
  }

  @Get(":id")
  @RequiresRole(...TENANTS_PERMISSIONS.read)
  getById(@Param("id") id: string) {
    return this.tenantsService.getTenantById(id);
  }
}
