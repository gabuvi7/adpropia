import { Body, Controller, Inject, Post } from "@nestjs/common";
import { accessRequestSchema } from "@adpropia/shared";
import { Public } from "../../common/auth/public.decorator";
import { parseRequestBody } from "../../common/validation/zod-validation";
import { AccessRequestsService } from "./access-requests.service";

@Controller("access-requests")
export class AccessRequestsController {
  constructor(@Inject(AccessRequestsService) private readonly accessRequestsService: AccessRequestsService) {}

  @Post()
  @Public()
  create(@Body() body: unknown) {
    return this.accessRequestsService.submit(parseRequestBody(accessRequestSchema, body));
  }
}
