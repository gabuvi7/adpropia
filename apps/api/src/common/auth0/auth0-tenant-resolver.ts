import { ForbiddenException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { PLATFORM_ROLE_SUPERADMIN, type AuthRole } from "../auth/auth-role";
import { PrismaService } from "../prisma/prisma.service";

export type Auth0JwtClaims = {
  sub: string;
  org_id?: string;
  [key: string]: unknown;
};

export const AUTH0_SUPERADMIN_CLAIM = "https://adpropia.app/superadmin";
export const AUTH0_PLATFORM_ROLES_CLAIM = "https://adpropia.com/roles";

export type TenantResolution = {
  tenantId: string;
  userId: string;
  role: AuthRole;
};

function hasSuperadminClaim(claims: Auth0JwtClaims): boolean {
  if (claims[AUTH0_SUPERADMIN_CLAIM] === true) {
    return true;
  }

  const platformRoles = claims[AUTH0_PLATFORM_ROLES_CLAIM];
  return Array.isArray(platformRoles) && platformRoles.includes(PLATFORM_ROLE_SUPERADMIN);
}

function getStringClaim(claims: Auth0JwtClaims, claimNames: string[]): string | undefined {
  for (const claimName of claimNames) {
    const value = claims[claimName];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function getEmailClaim(claims: Auth0JwtClaims): string | undefined {
  const email = getStringClaim(claims, ["email", "https://adpropia.app/email"]);
  return email?.includes("@") ? email.toLowerCase() : undefined;
}

function getNameClaim(claims: Auth0JwtClaims): string | undefined {
  return getStringClaim(claims, ["name", "nickname", "preferred_username", "https://adpropia.app/name"]);
}

@Injectable()
export class Auth0TenantResolver {
  private readonly logger = new Logger(Auth0TenantResolver.name);

  constructor(private readonly prisma: PrismaService) {}

  async resolve(claims: Auth0JwtClaims): Promise<TenantResolution> {
    const { org_id: auth0OrgId, sub: auth0UserId } = claims;
    const isSuperadmin = hasSuperadminClaim(claims);

    if (!auth0OrgId && !isSuperadmin) {
      throw new UnauthorizedException("Falta organizacion en el token.");
    }

    if (!auth0UserId) {
      throw new UnauthorizedException("Falta usuario en el token.");
    }

    if (isSuperadmin && !auth0OrgId) {
      const user = await this.prisma.user.findUnique({ where: { auth0UserId } } as never);

      if (!user) {
        this.logger.warn({ event: "user_not_found", auth0UserId });
        throw new UnauthorizedException("Usuario no encontrado.");
      }

      if (!user.isActive) {
        this.logger.warn({ event: "user_inactive", auth0UserId });
        throw new UnauthorizedException("El usuario no esta activo.");
      }

      this.logger.log({ event: "platform_role_resolved", userId: user.id, role: PLATFORM_ROLE_SUPERADMIN });

      return {
        tenantId: "platform",
        userId: user.id,
        role: PLATFORM_ROLE_SUPERADMIN
      };
    }

    const [tenant, existingUser] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { auth0OrgId } } as never),
      this.prisma.user.findUnique({ where: { auth0UserId } } as never)
    ]);

    if (!tenant) {
      this.logger.warn({ event: "tenant_not_found", auth0OrgId });
      throw new ForbiddenException("Inmobiliaria no encontrada.");
    }

    if (tenant.status !== "ACTIVE") {
      this.logger.warn({ event: "tenant_inactive", auth0OrgId, status: tenant.status });
      throw new ForbiddenException("La inmobiliaria no esta activa.");
    }

    let user = existingUser;

    if (!user) {
      const email = getEmailClaim(claims);

      if (!email) {
        this.logger.warn({ event: "user_email_missing", auth0UserId });
        throw new ForbiddenException("No se pudo crear el usuario local.");
      }

      user = await this.prisma.user.create({
        data: {
          auth0UserId,
          email,
          name: getNameClaim(claims),
          isActive: true
        }
      } as never);

      this.logger.log({ event: "user_auto_created", auth0UserId, userId: user.id });
    }

    if (!user.isActive) {
      this.logger.warn({ event: "user_inactive", auth0UserId });
      throw new ForbiddenException("El usuario no esta activo.");
    }

    if (isSuperadmin) {
      this.logger.log({ event: "superadmin_resolved", tenantId: tenant.id, userId: user.id });
      return {
        tenantId: tenant.id,
        userId: user.id,
        role: PLATFORM_ROLE_SUPERADMIN
      };
    }

    const membership = await this.prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } }
    });

    if (!membership) {
      this.logger.warn({ event: "membership_not_found", auth0OrgId, auth0UserId, tenantId: tenant.id, userId: user.id });
      throw new ForbiddenException("No tenes acceso a esta inmobiliaria.");
    }

    if (!membership.isActive) {
      this.logger.warn({ event: "membership_inactive", tenantId: tenant.id, userId: user.id });
      throw new ForbiddenException("Tu acceso a esta inmobiliaria no esta activo.");
    }

    this.logger.log({ event: "tenant_resolved", tenantId: tenant.id, userId: user.id, role: membership.role });

    return {
      tenantId: tenant.id,
      userId: user.id,
      role: membership.role as AuthRole
    };
  }
}
