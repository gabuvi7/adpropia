import { Controller, Get, Inject } from "@nestjs/common";
import { RequiresRole } from "../../common/auth/roles.decorator";
import { ALL_ROLES } from "../../common/auth/permissions";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Get("me")
  @RequiresRole(...ALL_ROLES)
  async me() {
    return this.authService.getBootstrap();
  }
}
