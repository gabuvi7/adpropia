import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { RequiresRole } from "../../common/auth/roles.decorator";
import { CORE_ENTITY_PERMISSIONS } from "../../common/auth/permissions";
import { parseRequestBody } from "../../common/validation/zod-validation";
import { createOwnerSchema, updateOwnerSchema } from "./owners.dto";
import { OwnersService } from "./owners.service";

@Controller("owners")
export class OwnersController {
  constructor(private readonly ownersService: OwnersService) {}

  @Post()
  @RequiresRole(...CORE_ENTITY_PERMISSIONS.create)
  create(@Body() body: unknown) {
    return this.ownersService.createOwner(parseRequestBody(createOwnerSchema, body));
  }

  @Get()
  @RequiresRole(...CORE_ENTITY_PERMISSIONS.list)
  list() {
    return this.ownersService.listOwners();
  }

  @Get(":id")
  @RequiresRole(...CORE_ENTITY_PERMISSIONS.read)
  getById(@Param("id") id: string) {
    return this.ownersService.getOwnerById(id);
  }

  @Patch(":id")
  @RequiresRole(...CORE_ENTITY_PERMISSIONS.update)
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.ownersService.updateOwner(id, parseRequestBody(updateOwnerSchema, body));
  }
}
