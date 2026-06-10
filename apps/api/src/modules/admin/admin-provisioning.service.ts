import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { TenantRole } from "@adpropia/shared";
import type { Prisma } from "@adpropia/database";
import { PrismaService } from "../../common/prisma";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { AuditService } from "../audit/audit.service";

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
        throw new NotFoundException("Tenant not found.");
      }
      if (hasPrismaCode(error, "P2002")) {
        throw new ConflictException("Auth0 organization ID is already linked to another tenant.");
      }
      throw error;
    }
  }

  async linkUserAuth0Subject(userId: string, auth0UserId: string): Promise<LinkUserAuth0SubjectResult> {
    const ctx = this.contextService.get();

    try {
      return await this.prisma.$transaction(async (tx) => {
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
        throw new NotFoundException("User not found.");
      }
      if (hasPrismaCode(error, "P2002")) {
        throw new ConflictException("Auth0 subject is already linked to another user.");
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
    const now = new Date();

    const membership = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const tenant = await tx.tenant.findUnique({ where: { id: dto.tenantId }, select: { id: true } });
      if (!tenant) {
        throw new NotFoundException("Tenant not found.");
      }

      const user = await tx.user.findUnique({ where: { id: dto.userId }, select: { id: true } });
      if (!user) {
        throw new NotFoundException("User not found.");
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

function hasPrismaCode(error: unknown, code: string): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return (error as { code?: unknown }).code === code;
}
