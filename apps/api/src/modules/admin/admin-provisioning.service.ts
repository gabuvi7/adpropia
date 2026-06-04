import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { TenantRole } from "@adpropia/shared";
import type { Prisma } from "@adpropia/database";
import { PrismaService } from "../../common/prisma";

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
  constructor(private readonly prisma: PrismaService) {}

  async linkTenantAuth0Org(tenantId: string, auth0OrgId: string): Promise<LinkTenantAuth0OrgResult> {
    try {
      const tenant = await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { auth0OrgId },
        select: { id: true, name: true, slug: true, status: true, auth0OrgId: true }
      });
      return { tenant };
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
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { auth0UserId },
        select: { id: true, email: true, name: true, isActive: true, auth0UserId: true }
      });
      return { user };
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

      return tx.tenantUser.upsert({
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
