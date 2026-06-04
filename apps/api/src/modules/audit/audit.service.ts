import { Injectable } from "@nestjs/common";
import type { Prisma } from "@adpropia/database";
import { PrismaService } from "../../common/prisma";
import type { RequestContext } from "../../common/request-context/request-context";

export type AuditEntryInput = Readonly<{
  entityType: string;
  entityId?: string;
  action: string;
  metadata?: Record<string, unknown>;
  /** Override for cross-tenant/admin operations where target tenant differs from context. */
  tenantId?: string;
}>;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async createEntry(context: RequestContext, input: AuditEntryInput) {
    return this.createEntryWithClient(this.prisma, context, input);
  }

  async createEntryWithClient(
    client: { auditLog: { create: (args: Prisma.AuditLogCreateArgs) => Promise<unknown> } },
    context: RequestContext,
    input: AuditEntryInput
  ) {
    return client.auditLog.create({
      data: {
        tenantId: input.tenantId ?? context.tenantId,
        userId: context.userId,
        requestId: context.requestId,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        action: input.action,
        ...(input.metadata !== undefined ? { metadata: input.metadata as Prisma.InputJsonValue } : {})
      }
    });
  }
}
