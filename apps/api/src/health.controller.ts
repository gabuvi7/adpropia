import { Controller, Get } from "@nestjs/common";
import { Public } from "./common/auth/public.decorator";

type HealthResponse = Readonly<{
  status: "ok";
}>;

@Controller("health")
export class HealthController {
  @Public()
  @Get()
  getHealth(): HealthResponse {
    return { status: "ok" };
  }
}
