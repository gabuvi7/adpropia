import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, TenantStatus } from "@adpropia/database";
import { buildChangedFieldsMetadata } from "@adpropia/shared";
import { hasMinimumRole } from "../../common/auth/permissions";
import { PrismaService } from "../../common/prisma";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { AuditService } from "../audit/audit.service";
import type { CreateTenantDto, UpdateTenantSettingsDto } from "./tenants.dto";

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

  async updateCurrentTenantSettings(input: UpdateTenantSettingsDto): Promise<TenantWithSettings> {
    const ctx = this.contextService.get();
    if (!hasMinimumRole(ctx.role, "ADMIN")) {
      throw new ForbiddenException("No tenés permisos para actualizar la configuración de la inmobiliaria.");
    }

    const settings = await this.prisma.tenantSettings.findUnique({ where: { tenantId: ctx.tenantId } });
    if (!settings) {
      throw new NotFoundException("No encontramos la configuración de la inmobiliaria solicitada.");
    }

    const data = toTenantSettingsUpdateData(input);
    const metadata = buildChangedFieldsMetadata(data);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updatedSettings = await tx.tenantSettings.update({
          where: { tenantId: ctx.tenantId },
          data
        });

        const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, include: { settings: true } });

        await this.audit.createEntryWithClient(tx, ctx, {
          tenantId: ctx.tenantId,
          entityType: "tenant_settings",
          entityId: updatedSettings.id,
          action: "tenant_settings.updated",
          metadata
        });

        return tenant;
      });
    } catch (error) {
      if (hasPrismaCode(error, "P2025")) {
        throw new NotFoundException("No encontramos la configuración de la inmobiliaria solicitada.");
      }

      throw new BadRequestException("No pudimos actualizar la configuración de la inmobiliaria. Revisá los datos enviados.");
    }
  }

  resolveActiveTenant(tenant: TenantSummary): TenantSummary {
    if (tenant.status !== "ACTIVE") {
      throw new BadRequestException("La inmobiliaria no está activa.");
    }

    return tenant;
  }
}

function toTenantSettingsUpdateData(input: UpdateTenantSettingsDto): Prisma.TenantSettingsUpdateInput {
  return {
    ...(input.commercialName !== undefined ? { commercialName: input.commercialName } : {}),
    ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
    ...(input.primaryColor !== undefined ? { primaryColor: input.primaryColor } : {}),
    ...(input.defaultCurrency !== undefined ? { defaultCurrency: input.defaultCurrency } : {}),
    ...(input.defaultCommissionBps !== undefined ? { defaultCommissionBps: input.defaultCommissionBps } : {}),
    ...(input.operationalParameters !== undefined
      ? { operationalParameters: input.operationalParameters as Prisma.InputJsonValue }
      : {})
  };
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
