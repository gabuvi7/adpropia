import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  Inject,
  Logger,
  UnauthorizedException
} from "@nestjs/common";
import { RequestContextService } from "../request-context/request-context.service";

@Injectable()
export class Auth0Guard implements CanActivate {
  private readonly logger = new Logger(Auth0Guard.name);

  constructor(
    @Inject(RequestContextService)
    private readonly contextService: RequestContextService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const ctx = this.contextService.getOptional();

    if (!ctx) {
      this.logger.warn({ event: "auth_guard_no_context" });
      throw new UnauthorizedException("No autenticado.");
    }

    return true;
  }
}
