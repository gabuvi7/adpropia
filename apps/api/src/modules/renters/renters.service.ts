import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, Renter } from "@adpropia/database";
import { buildChangedFieldsMetadata } from "@adpropia/shared";
import { PrismaService } from "../../common/prisma";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { AuditService } from "../audit/audit.service";
import type { CreateRenterDto, UpdateRenterDto } from "./renters.dto";

export type RenterRecord = Renter;

@Injectable()
export class RentersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contextService: RequestContextService,
    private readonly audit: AuditService
  ) {}

  async createRenter(input: CreateRenterDto): Promise<RenterRecord> {
    const ctx = this.contextService.get();
    const { tenantId } = ctx;
    const data = {
      tenantId,
      displayName: input.displayName,
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.identityNumber !== undefined ? { identityNumber: input.identityNumber } : {}),
      ...(input.guaranteeInfo !== undefined ? { guaranteeInfo: input.guaranteeInfo as Prisma.InputJsonValue } : {})
    };

    try {
      return await this.prisma.$transaction(async (tx) => {
        const renter = await tx.renter.create({ data });

        await this.audit.createEntryWithClient(tx, ctx, {
          entityType: "renter",
          entityId: renter.id,
          action: "renter.created",
          metadata: { name: input.displayName }
        });

        return renter;
      });
    } catch (error) {
      if (hasPrismaCode(error, "P2002")) {
        throw new BadRequestException("Ya existe un inquilino con esos datos en esta inmobiliaria.");
      }

      throw new BadRequestException("No pudimos crear el inquilino. Revisá los datos enviados.");
    }
  }

  listRenters(): Promise<RenterRecord[]> {
    const { tenantId } = this.contextService.get();
    return this.prisma.renter.findMany({ where: { tenantId, deletedAt: null }, orderBy: { displayName: "asc" } });
  }

  async getRenterById(id: string): Promise<RenterRecord> {
    const renter = await this.findActiveRenter(id);
    if (!renter) {
      throw new NotFoundException("No encontramos el inquilino solicitado.");
    }

    return renter;
  }

  findRenterForTenant(id: string) {
    return this.getRenterById(id);
  }

  async updateRenter(id: string, input: UpdateRenterDto): Promise<RenterRecord> {
    const ctx = this.contextService.get();
    const { tenantId } = ctx;
    const renter = await this.findActiveRenter(id, tenantId);

    if (!renter) {
      throw new NotFoundException("No encontramos el inquilino solicitado.");
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.renter.update({
          where: { id_tenantId: { id, tenantId } },
          data: toRenterUpdateData(input)
        });

        await this.audit.createEntryWithClient(tx, ctx, {
          entityType: "renter",
          entityId: id,
          action: "renter.updated",
          metadata: buildChangedFieldsMetadata(input)
        });

        return updated;
      });
    } catch (error) {
      if (hasPrismaCode(error, "P2002")) {
        throw new BadRequestException("Ya existe un inquilino con esos datos en esta inmobiliaria.");
      }

      throw new BadRequestException("No pudimos actualizar el inquilino. Revisá los datos enviados.");
    }
  }

  private findActiveRenter(id: string, tenantId = this.contextService.get().tenantId): Promise<RenterRecord | null> {
    return this.prisma.renter.findFirst({ where: { id, tenantId, deletedAt: null } });
  }
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function toRenterUpdateData(input: UpdateRenterDto): Prisma.RenterUpdateInput {
  return {
    ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
    ...(input.email !== undefined ? { email: input.email } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
    ...(input.identityNumber !== undefined ? { identityNumber: input.identityNumber } : {}),
    ...(input.guaranteeInfo !== undefined ? { guaranteeInfo: input.guaranteeInfo as Prisma.InputJsonValue } : {})
  };
}
