import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { TenantRole } from "@adpropia/shared";
import type { Prisma } from "@adpropia/database";
import type { AuthRole } from "../../common/auth/auth-role";
import { PrismaService } from "../../common/prisma";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { AuditService } from "../audit/audit.service";

const ADMIN_ASSIGNABLE_ROLES = new Set<TenantRole>(["ADMIN", "OPERATOR", "READONLY"]);
const ERR_TENANT_NOT_FOUND = "No se encontró el tenant.";
const ERR_AUTH0_ORG_CONFLICT = "El ID de organización de Auth0 ya está vinculado a otro tenant.";
const ERR_USER_NOT_FOUND = "No se encontró el usuario.";
const ERR_AUTH0_SUBJECT_CONFLICT = "El subject de Auth0 ya está vinculado a otro usuario.";
const ERR_OUTSIDE_ACTIVE_TENANT = "No podés provisionar fuera del tenant activo.";
const ERR_ROLE_NOT_ALLOWED = "No podés asignar ese rol.";
const ERR_INSUFFICIENT_PERMISSIONS = "No tenés permisos suficientes.";
const ERR_OWNER_SUBJECT_RESTRICTED = "No podés vincular el subject de Auth0 de un OWNER.";
const ERR_AUTH0_SUBJECT_OVERWRITE_RESTRICTED = "No podés sobrescribir un subject de Auth0 existente.";

export type LinkTenantAuth0OrgResult = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: string;
    auth0OrgId: string | null;
  };
};

export type LinkUserAuth0SubjectResult = {
  user: {
    id: string;
    email: string;
    name: string | null;
    isActive: boolean;
    auth0UserId: string | null;
  };
};

export type ProvisionMembershipResult = {
  membership: {
    id: string;
    tenantId: string;
    userId: string;
    role: TenantRole;
    isActive: boolean;
    acceptedAt: Date | null;
  };
};

@Injectable()
export class AdminProvisioningService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AuditService)
    private readonly audit: AuditService,
    @Inject(RequestContextService)
    private readonly contextService: RequestContextService
  ) {}

  async linkTenantAuth0Org(targetTenantId: string, auth0OrgId: string): Promise<LinkTenantAuth0OrgResult> {
    const ctx = this.contextService.get();
    assertCanManageTenant(ctx.role, ctx.tenantId, targetTenantId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.update({
          where: { id: targetTenantId },
          data: { auth0OrgId },
          select: { id: true, name: true, slug: true, status: true, auth0OrgId: true }
        });

        await this.audit.createEntryWithClient(tx, ctx, {
          tenantId: targetTenantId,
          entityType: "tenant",
          entityId: targetTenantId,
          action: "admin-provisioning.auth0-org.linked"
        });

        return { tenant };
      });
    } catch (error) {
      if (hasPrismaCode(error, "P2025")) {
        throw new NotFoundException(ERR_TENANT_NOT_FOUND);
      }
      if (hasPrismaCode(error, "P2002")) {
        throw new ConflictException(ERR_AUTH0_ORG_CONFLICT);
      }
      throw error;
    }
  }

  async linkUserAuth0Subject(userId: string, auth0UserId: string): Promise<LinkUserAuth0SubjectResult> {
    const ctx = this.contextService.get();
    assertAdminOrHigher(ctx.role);

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (ctx.role !== "SUPERADMIN") {
          const membership = await tx.tenantUser.findUnique({
            where: { tenantId_userId: { tenantId: ctx.tenantId, userId } },
            select: { id: true, isActive: true, role: true }
          });
          if (!membership?.isActive) {
            throw new ForbiddenException(ERR_OUTSIDE_ACTIVE_TENANT);
          }
          if (membership.role === "OWNER") {
            throw new ForbiddenException(ERR_OWNER_SUBJECT_RESTRICTED);
          }

          const ownerMembership = await tx.tenantUser.findFirst({
            where: { userId, role: "OWNER", isActive: true },
            select: { id: true }
          });
          if (ownerMembership) {
            throw new ForbiddenException(ERR_OWNER_SUBJECT_RESTRICTED);
          }

          const updateResult = await tx.user.updateMany({
            where: { id: userId, auth0UserId: null },
            data: { auth0UserId }
          });
          if (updateResult.count === 0) {
            const targetUser = await tx.user.findUnique({
              where: { id: userId },
              select: { auth0UserId: true }
            });

            if (!targetUser) {
              throw new NotFoundException(ERR_USER_NOT_FOUND);
            }

            throw new ForbiddenException(ERR_AUTH0_SUBJECT_OVERWRITE_RESTRICTED);
          }

          const user = await tx.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, name: true, isActive: true, auth0UserId: true }
          });
          if (!user) {
            throw new NotFoundException(ERR_USER_NOT_FOUND);
          }

          await this.audit.createEntryWithClient(tx, ctx, {
            entityType: "user",
            entityId: userId,
            action: "admin-provisioning.auth0-subject.linked"
          });

          return { user };
        }

        const user = await tx.user.update({
          where: { id: userId },
          data: { auth0UserId },
          select: { id: true, email: true, name: true, isActive: true, auth0UserId: true }
        });

        await this.audit.createEntryWithClient(tx, ctx, {
          entityType: "user",
          entityId: userId,
          action: "admin-provisioning.auth0-subject.linked"
        });

        return { user };
      });
    } catch (error) {
      if (hasPrismaCode(error, "P2025")) {
        throw new NotFoundException(ERR_USER_NOT_FOUND);
      }
      if (hasPrismaCode(error, "P2002")) {
        throw new ConflictException(ERR_AUTH0_SUBJECT_CONFLICT);
      }
      throw error;
    }
  }

  async provisionMembership(dto: {
    tenantId: string;
    userId: string;
    role: TenantRole;
  }): Promise<ProvisionMembershipResult> {
    const ctx = this.contextService.get();
    assertCanProvisionMembership(ctx.role, ctx.tenantId, dto.tenantId, dto.role);
    const now = new Date();

    const membership = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const tenant = await tx.tenant.findUnique({ where: { id: dto.tenantId }, select: { id: true } });
      if (!tenant) {
        throw new NotFoundException(ERR_TENANT_NOT_FOUND);
      }

      const user = await tx.user.findUnique({ where: { id: dto.userId }, select: { id: true } });
      if (!user) {
        throw new NotFoundException(ERR_USER_NOT_FOUND);
      }

      const result = await tx.tenantUser.upsert({
        where: { tenantId_userId: { tenantId: dto.tenantId, userId: dto.userId } },
        create: {
          tenantId: dto.tenantId,
          userId: dto.userId,
          role: dto.role,
          isActive: true,
          acceptedAt: now
        },
        update: {
          role: dto.role,
          isActive: true,
          acceptedAt: now
        },
        select: { id: true, tenantId: true, userId: true, role: true, isActive: true, acceptedAt: true }
      });

      await this.audit.createEntryWithClient(tx, ctx, {
        tenantId: dto.tenantId,
        entityType: "tenant",
        entityId: dto.tenantId,
        action: "admin-provisioning.membership.provisioned",
        metadata: { userId: dto.userId, role: dto.role }
      });

      return result;
    });

    return { membership };
  }
}

function assertCanManageTenant(role: AuthRole, activeTenantId: string, targetTenantId: string): void {
  assertAdminOrHigher(role);

  if (role !== "SUPERADMIN" && targetTenantId !== activeTenantId) {
    throw new ForbiddenException(ERR_OUTSIDE_ACTIVE_TENANT);
  }
}

function assertCanProvisionMembership(
  role: AuthRole,
  activeTenantId: string,
  targetTenantId: string,
  targetRole: TenantRole
): void {
  assertCanManageTenant(role, activeTenantId, targetTenantId);

  if (role === "ADMIN" && !ADMIN_ASSIGNABLE_ROLES.has(targetRole)) {
    throw new ForbiddenException(ERR_ROLE_NOT_ALLOWED);
  }
}

function assertAdminOrHigher(role: AuthRole): void {
  if (role === "OPERATOR" || role === "READONLY") {
    throw new ForbiddenException(ERR_INSUFFICIENT_PERMISSIONS);
  }
}

function hasPrismaCode(error: unknown, code: string): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return (error as { code?: unknown }).code === code;
}
