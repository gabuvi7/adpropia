import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { RequiresRole } from "../../common/auth/roles.decorator";
import { CORE_ENTITY_PERMISSIONS } from "../../common/auth/permissions";
import { parseRequestBody } from "../../common/validation/zod-validation";
import { createPropertySchema, createPropertyUnitSchema, updatePropertyOwnershipSchema, updatePropertySchema } from "./properties.dto";
import { PropertiesService } from "./properties.service";

@Controller("properties")
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Post()
  @RequiresRole(...CORE_ENTITY_PERMISSIONS.create)
  create(@Body() body: unknown) {
    return this.propertiesService.createProperty(parseRequestBody(createPropertySchema, body));
  }

  @Post("units")
  @RequiresRole(...CORE_ENTITY_PERMISSIONS.create)
  createUnit(@Body() body: unknown) {
    return this.propertiesService.createPropertyUnit(parseRequestBody(createPropertyUnitSchema, body));
  }

  @Get()
  @RequiresRole(...CORE_ENTITY_PERMISSIONS.list)
  list() {
    return this.propertiesService.listProperties();
  }

  @Get(":id")
  @RequiresRole(...CORE_ENTITY_PERMISSIONS.read)
  getById(@Param("id") id: string) {
    return this.propertiesService.getPropertyById(id);
  }

  @Patch(":id")
  @RequiresRole(...CORE_ENTITY_PERMISSIONS.update)
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.propertiesService.updateProperty(id, parseRequestBody(updatePropertySchema, body));
  }

  @Patch(":id/ownership")
  @RequiresRole(...CORE_ENTITY_PERMISSIONS.update)
  updateOwnership(@Param("id") id: string, @Body() body: unknown) {
    const parsed = parseRequestBody(updatePropertyOwnershipSchema, body);
    return this.propertiesService.updatePropertyOwnership(id, parsed.owners);
  }
}
