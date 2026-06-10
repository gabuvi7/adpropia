import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, TenantStatus } from "@adpropia/database";
import { PrismaService } from "../../common/prisma";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { AuditService } from "../audit/audit.service";
import type { CreateTenantDto } from "./tenants.dto";

export type TenantSummary = Readonly<{ id: string; slug: string; name: string; status: TenantStatus }>;
export type TenantWithSettings = Prisma.TenantGetPayload<{ include: { settings: true } }>;

@Injectable()
export class TenantsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AuditService)
    private readonly audit: AuditService,
    @Inject(RequestContextService)
    private readonly contextService: RequestContextService
  ) {}

  async createTenant(input: CreateTenantDto): Promise<TenantWithSettings> {
    const settingsData = {
      commercialName: input.settings.commercialName,
      defaultCurrency: input.settings.defaultCurrency,
      defaultCommissionBps: input.settings.defaultCommissionBps,
      ...(input.settings.logoUrl !== undefined ? { logoUrl: input.settings.logoUrl } : {}),
      ...(input.settings.primaryColor !== undefined ? { primaryColor: input.settings.primaryColor } : {}),
      ...(input.settings.operationalParameters !== undefined
        ? { operationalParameters: input.settings.operationalParameters as Prisma.InputJsonValue }
        : {})
    };

    const ctx = this.contextService.get();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: input.name,
            slug: input.slug,
            ...(input.customDomain !== undefined ? { customDomain: input.customDomain } : {}),
            settings: { create: settingsData }
          },
          include: { settings: true }
        });

        await this.audit.createEntryWithClient(tx, ctx, {
          tenantId: tenant.id,
          entityType: "tenant",
          entityId: tenant.id,
          action: "tenant.created",
          metadata: { slug: tenant.slug, name: tenant.name }
        });

        return tenant;
      });
    } catch (error) {
      if (hasPrismaCode(error, "P2002")) {
        throw new BadRequestException("Ya existe una inmobiliaria con esos datos.");
      }

      throw new BadRequestException("No pudimos crear la inmobiliaria. Revisá los datos enviados.");
    }
  }

  listTenants(): Promise<TenantWithSettings[]> {
    return this.prisma.tenant.findMany({ include: { settings: true }, orderBy: { createdAt: "desc" } });
  }

  async getTenantById(id: string): Promise<TenantWithSettings> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id }, include: { settings: true } });
    if (!tenant) {
      throw new NotFoundException("No encontramos la inmobiliaria solicitada.");
    }

    return tenant;
  }

  resolveActiveTenant(tenant: TenantSummary): TenantSummary {
    if (tenant.status !== "ACTIVE") {
      throw new BadRequestException("La inmobiliaria no está activa.");
    }

    return tenant;
  }
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
