import { Injectable } from "@nestjs/common";
import type { Prisma } from "@adpropia/database";
import { parseAuditMetadata, redactAuditMetadata } from "@adpropia/shared";
import { PrismaService } from "../../common/prisma";
import type { RequestContext } from "../../common/request-context/request-context";
import type { AuditLogQuery } from "./audit.dto";

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

  async listAuditLogs(query: AuditLogQuery) {
    const where = this.buildListWhere(query);
    const page = query.page;
    const pageSize = query.pageSize;
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.auditLog.count({ where })
    ]);

    return { items, page, pageSize, total };
  }

  async createEntry(context: RequestContext, input: AuditEntryInput) {
    return this.createEntryWithClient(this.prisma, context, input);
  }

  async createEntryWithClient(
    client: { auditLog: { create: (args: Prisma.AuditLogCreateArgs) => Promise<unknown> } },
    context: RequestContext,
    input: AuditEntryInput
  ) {
    const metadata = this.normalizeMetadata(input.action, input.metadata);

    return client.auditLog.create({
      data: {
        tenantId: input.tenantId ?? context.tenantId,
        userId: context.userId,
        requestId: context.requestId,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        action: input.action,
        ...(metadata !== undefined ? { metadata: metadata as Prisma.InputJsonValue } : {})
      }
    });
  }

  private normalizeMetadata(action: string, metadata: Record<string, unknown> | undefined) {
    if (metadata === undefined) {
      return undefined;
    }

    return parseAuditMetadata(action, redactAuditMetadata(metadata));
  }

  private buildListWhere(query: AuditLogQuery): Prisma.AuditLogWhereInput {
    return {
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {})
            }
          }
        : {})
    };
  }
}
