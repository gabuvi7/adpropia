import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import type { TenantRole } from "@adpropia/shared";
import { PrismaService } from "../../common/prisma/prisma.service";
import { RequestContextService } from "../../common/request-context/request-context.service";

export type AuthBootstrap = {
  userId: string;
  tenantId: string;
  tenantName: string;
  role: TenantRole;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly contextService: RequestContextService,
    private readonly prisma: PrismaService,
  ) {}

  async getBootstrap(): Promise<AuthBootstrap> {
    const ctx = this.contextService.get();

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { name: true },
    });

    if (!tenant) {
      this.logger.warn({ event: "bootstrap_tenant_not_found", tenantId: ctx.tenantId });
      throw new UnauthorizedException("Inmobiliaria no encontrada.");
    }

    return {
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      tenantName: tenant.name,
      role: ctx.role,
    };
  }
}
