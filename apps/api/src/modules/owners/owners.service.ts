import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Owner, Prisma } from "@adpropia/database";
import { buildChangedFieldsMetadata } from "@adpropia/shared";
import { PrismaService } from "../../common/prisma";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { AuditService } from "../audit/audit.service";
import type { CreateOwnerDto, UpdateOwnerDto } from "./owners.dto";

export type OwnerRecord = Owner;

@Injectable()
export class OwnersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contextService: RequestContextService,
    private readonly audit: AuditService
  ) {}

  async createOwner(input: CreateOwnerDto): Promise<OwnerRecord> {
    const ctx = this.contextService.get();
    const { tenantId } = ctx;
    const data = {
      tenantId,
      displayName: input.displayName,
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.taxId !== undefined ? { taxId: input.taxId } : {}),
      ...(input.paymentDetails !== undefined ? { paymentDetails: input.paymentDetails as Prisma.InputJsonValue } : {})
    };

    try {
      return await this.prisma.$transaction(async (tx) => {
        const owner = await tx.owner.create({ data });

        await this.audit.createEntryWithClient(tx, ctx, {
          entityType: "owner",
          entityId: owner.id,
          action: "owner.created",
          metadata: { name: input.displayName }
        });

        return owner;
      });
    } catch (error) {
      if (hasPrismaCode(error, "P2002")) {
        throw new BadRequestException("Ya existe un propietario con esos datos en esta inmobiliaria.");
      }

      throw new BadRequestException("No pudimos crear el propietario. Revisá los datos enviados.");
    }
  }

  listOwners(): Promise<OwnerRecord[]> {
    const { tenantId } = this.contextService.get();
    return this.prisma.owner.findMany({ where: { tenantId, deletedAt: null }, orderBy: { displayName: "asc" } });
  }

  async getOwnerById(id: string): Promise<OwnerRecord> {
    const owner = await this.findActiveOwner(id);
    if (!owner) {
      throw new NotFoundException("No encontramos el propietario solicitado.");
    }

    return owner;
  }

  findOwnerForTenant(id: string) {
    return this.getOwnerById(id);
  }

  async updateOwner(id: string, input: UpdateOwnerDto): Promise<OwnerRecord> {
    const ctx = this.contextService.get();
    const { tenantId } = ctx;
    const owner = await this.findActiveOwner(id, tenantId);

    if (!owner) {
      throw new NotFoundException("No encontramos el propietario solicitado.");
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.owner.update({
          where: { id_tenantId: { id, tenantId } },
          data: toOwnerUpdateData(input)
        });

        await this.audit.createEntryWithClient(tx, ctx, {
          entityType: "owner",
          entityId: id,
          action: "owner.updated",
          metadata: buildChangedFieldsMetadata(input)
        });

        return updated;
      });
    } catch (error) {
      if (hasPrismaCode(error, "P2002")) {
        throw new BadRequestException("Ya existe un propietario con esos datos en esta inmobiliaria.");
      }

      throw new BadRequestException("No pudimos actualizar el propietario. Revisá los datos enviados.");
    }
  }

  private findActiveOwner(id: string, tenantId = this.contextService.get().tenantId): Promise<OwnerRecord | null> {
    return this.prisma.owner.findFirst({ where: { id, tenantId, deletedAt: null } });
  }
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function toOwnerUpdateData(input: UpdateOwnerDto): Prisma.OwnerUpdateInput {
  return {
    ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
    ...(input.email !== undefined ? { email: input.email } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
    ...(input.taxId !== undefined ? { taxId: input.taxId } : {}),
    ...(input.paymentDetails !== undefined ? { paymentDetails: input.paymentDetails as Prisma.InputJsonValue } : {})
  };
}
