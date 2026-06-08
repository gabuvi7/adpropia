import { Body, Controller, Post } from "@nestjs/common";
import { CORE_ENTITY_PERMISSIONS } from "../../common/auth/permissions";
import { RequiresRole } from "../../common/auth/roles.decorator";
import { parseRequestBody } from "../../common/validation/zod-validation";
import { persistPublishedIndexSchema } from "./indices.dto";
import { IndicesService } from "./indices.service";

@Controller("indices")
export class IndicesController {
  constructor(private readonly indicesService: IndicesService) {}

  @Post("published-values")
  @RequiresRole(...CORE_ENTITY_PERMISSIONS.update)
  persistPublishedIndex(@Body() body: unknown) {
    return this.indicesService.persistPublishedIndex(parseRequestBody(persistPublishedIndexSchema, body));
  }
}
