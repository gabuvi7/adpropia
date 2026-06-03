import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import type { TenantRole } from "@gu-prop/shared";
import { PrismaService } from "../prisma/prisma.service";

export type Auth0JwtClaims = {
  sub: string;
  org_id?: string;
  [key: string]: unknown;
};

export type TenantResolution = {
  tenantId: string;
  userId: string;
  role: TenantRole;
};

@Injectable()
export class Auth0TenantResolver {
  private readonly logger = new Logger(Auth0TenantResolver.name);

  constructor(private readonly prisma: PrismaService) {}

  async resolve(claims: Auth0JwtClaims): Promise<TenantResolution> {
    const { org_id: auth0OrgId, sub: auth0UserId } = claims;

    if (!auth0OrgId) {
      throw new UnauthorizedException("Falta organizacion en el token.");
    }

    if (!auth0UserId) {
      throw new UnauthorizedException("Falta usuario en el token.");
    }

    const [tenant, user] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { auth0OrgId } } as never),
      this.prisma.user.findUnique({ where: { auth0UserId } } as never)
    ]);

    if (!tenant) {
      this.logger.warn({ event: "tenant_not_found", auth0OrgId });
      throw new UnauthorizedException("Inmobiliaria no encontrada.");
    }

    if (tenant.status !== "ACTIVE") {
      this.logger.warn({ event: "tenant_inactive", auth0OrgId, status: tenant.status });
      throw new UnauthorizedException("La inmobiliaria no esta activa.");
    }

    if (!user) {
      this.logger.warn({ event: "user_not_found", auth0UserId });
      throw new UnauthorizedException("Usuario no encontrado.");
    }

    if (!user.isActive) {
      this.logger.warn({ event: "user_inactive", auth0UserId });
      throw new UnauthorizedException("El usuario no esta activo.");
    }

    const membership = await this.prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } }
    });

    if (!membership) {
      this.logger.warn({ event: "membership_not_found", auth0OrgId, auth0UserId, tenantId: tenant.id, userId: user.id });
      throw new UnauthorizedException("No tenes acceso a esta inmobiliaria.");
    }

    if (!membership.isActive) {
      this.logger.warn({ event: "membership_inactive", tenantId: tenant.id, userId: user.id });
      throw new UnauthorizedException("Tu acceso a esta inmobiliaria no esta activo.");
    }

    this.logger.log({ event: "tenant_resolved", tenantId: tenant.id, userId: user.id, role: membership.role });

    return {
      tenantId: tenant.id,
      userId: user.id,
      role: membership.role as TenantRole
    };
  }
}
