import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import type { AuthRole } from "./auth-role";
import { IS_PUBLIC_KEY } from "./public.decorator";
import { RequestContextService } from "../request-context/request-context.service";
import { hasMinimumRole } from "./permissions";
import { REQUIRES_ROLE_KEY } from "./roles.decorator";

export const AUTH_ROLE_ENFORCEMENT_KEY = "AUTH_ROLE_ENFORCEMENT";

function isRoleEnforcementEnabled(value?: string): boolean {
  return value !== "false";
}

type RoleCheckLog = {
  event: "role_check";
  enforcement: boolean;
  endpoint: string;
  path: string | undefined;
  method: string | undefined;
  expectedRoles: AuthRole[];
  actualRole: AuthRole | undefined;
  tenantId: string | undefined;
  userId: string | undefined;
  requestId: string | undefined;
};

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(RequestContextService)
    private readonly contextService: RequestContextService,
    @Inject(ConfigService)
    private readonly configService: ConfigService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic === true) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<AuthRole[] | undefined>(
      REQUIRES_ROLE_KEY,
      [context.getHandler(), context.getClass()]
    );

    const enforcementEnabled = isRoleEnforcementEnabled(
      this.configService.get<string>(AUTH_ROLE_ENFORCEMENT_KEY)
    );

    const requestContext = this.contextService.getOptional();
    const actualRole = requestContext?.role;

    const httpRequest = (() => {
      try {
        return context.switchToHttp().getRequest<{ url?: string; method?: string }>();
      } catch {
        return undefined;
      }
    })();

    if (!requiredRoles || requiredRoles.length === 0) {
      if (enforcementEnabled) {
        throw new ForbiddenException("No tenés permisos para realizar esta acción.");
      }

      const logPayload: RoleCheckLog = {
        event: "role_check",
        enforcement: false,
        endpoint: context.getHandler().name,
        path: httpRequest?.url,
        method: httpRequest?.method,
        expectedRoles: [],
        actualRole,
        tenantId: requestContext?.tenantId,
        userId: requestContext?.userId,
        requestId: requestContext?.requestId
      };
      this.logger.warn(logPayload);
      return true;
    }

    const allowed =
      actualRole !== undefined &&
      requiredRoles.some((required) => hasMinimumRole(actualRole, required));

    const logPayload: RoleCheckLog = {
      event: "role_check",
      enforcement: enforcementEnabled,
      endpoint: context.getHandler().name,
      path: httpRequest?.url,
      method: httpRequest?.method,
      expectedRoles: requiredRoles,
      actualRole,
      tenantId: requestContext?.tenantId,
      userId: requestContext?.userId,
      requestId: requestContext?.requestId
    };

    if (!allowed) {
      this.logger.warn(logPayload);
      if (enforcementEnabled) {
        throw new ForbiddenException("No tenés permisos para realizar esta acción.");
      }
      return true;
    }

    this.logger.log(logPayload);
    return true;
  }
}
