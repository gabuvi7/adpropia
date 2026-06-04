import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, RentalContract, RentalContractStatus } from "@adpropia/database";
import { PrismaService } from "../../common/prisma";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { AuditService } from "../audit/audit.service";
import type { CreateContractDto, UpdateContractDto } from "./contracts.dto";

export type ContractRecord = RentalContract;

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contextService: RequestContextService,
    private readonly audit: AuditService
  ) {}

  async createContract(input: CreateContractDto): Promise<ContractRecord> {
    const ctx = this.contextService.get();
    const { tenantId } = ctx;
    await this.ensureRelationsBelongToTenant(input.propertyId, input.ownerId, input.renterId, tenantId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const contract = await tx.rentalContract.create({ data: toContractCreateData(input, tenantId) });

        await this.audit.createEntryWithClient(tx, ctx, {
          entityType: "contract",
          entityId: contract.id,
          action: "contract.created",
          metadata: { propertyId: input.propertyId, ownerId: input.ownerId, renterId: input.renterId }
        });

        return contract;
      });
    } catch {
      throw new BadRequestException("No pudimos crear el contrato. Revisá los datos enviados.");
    }
  }

  listContracts(): Promise<ContractRecord[]> {
    const { tenantId } = this.contextService.get();
    return this.prisma.rentalContract.findMany({ where: { tenantId }, orderBy: { startsAt: "desc" } });
  }

  listActiveContracts(): Promise<ContractRecord[]> {
    const { tenantId } = this.contextService.get();
    return this.prisma.rentalContract.findMany({ where: { tenantId, status: "ACTIVE" }, orderBy: { startsAt: "desc" } });
  }

  async getContractById(id: string): Promise<ContractRecord> {
    const contract = await this.findContract(id);
    if (!contract) {
      throw new NotFoundException("No encontramos el contrato solicitado.");
    }

    return contract;
  }

  findContractForTenant(id: string) {
    return this.getContractById(id);
  }

  async updateContract(id: string, input: UpdateContractDto): Promise<ContractRecord> {
    const ctx = this.contextService.get();
    const { tenantId } = ctx;
    const contract = await this.findContract(id, tenantId);

    if (!contract) {
      throw new NotFoundException("No encontramos el contrato solicitado.");
    }

    const propertyId = input.propertyId ?? contract.propertyId;
    const ownerId = input.ownerId ?? contract.ownerId;
    const renterId = input.renterId ?? contract.renterId;
    await this.ensureRelationsBelongToTenant(propertyId, ownerId, renterId, tenantId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.rentalContract.update({
          where: { id_tenantId: { id, tenantId } },
          data: toContractUpdateData(input)
        });

        const changedFields = buildChangedFields(input);
        await this.audit.createEntryWithClient(tx, ctx, {
          entityType: "contract",
          entityId: id,
          action: "contract.updated",
          metadata: { changedFields }
        });

        return updated;
      });
    } catch {
      throw new BadRequestException("No pudimos actualizar el contrato. Revisá los datos enviados.");
    }
  }

  async changeContractStatus(id: string, status: RentalContractStatus): Promise<ContractRecord> {
    const ctx = this.contextService.get();
    const { tenantId } = ctx;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const contract = await tx.rentalContract.update({
          where: { id_tenantId: { id, tenantId } },
          data: { status }
        });

        await this.audit.createEntryWithClient(tx, ctx, {
          entityType: "contract",
          entityId: id,
          action: "contract.status.changed",
          metadata: { newStatus: status }
        });

        return contract;
      });
    } catch (error) {
      if (hasPrismaCode(error, "P2025")) {
        throw new NotFoundException("No encontramos el contrato solicitado.");
      }

      throw new BadRequestException("No pudimos cambiar el estado del contrato. Revisá los datos enviados.");
    }
  }

  private findContract(id: string, tenantId = this.contextService.get().tenantId): Promise<ContractRecord | null> {
    return this.prisma.rentalContract.findUnique({ where: { id_tenantId: { id, tenantId } } });
  }

  private async ensureRelationsBelongToTenant(propertyId: string, ownerId: string, renterId: string, tenantId: string): Promise<void> {
    const [property, owner, renter] = await Promise.all([
      this.prisma.property.findFirst({ where: { id: propertyId, tenantId, deletedAt: null } }),
      this.prisma.owner.findFirst({ where: { id: ownerId, tenantId, deletedAt: null } }),
      this.prisma.renter.findFirst({ where: { id: renterId, tenantId, deletedAt: null } })
    ]);

    if (!property) {
      throw new BadRequestException("La propiedad indicada no existe en esta inmobiliaria.");
    }

    if (!owner) {
      throw new BadRequestException("El propietario indicado no existe en esta inmobiliaria.");
    }

    if (!renter) {
      throw new BadRequestException("El inquilino indicado no existe en esta inmobiliaria.");
    }

    if (property.ownerId !== ownerId) {
      throw new BadRequestException("La propiedad indicada no pertenece al propietario seleccionado.");
    }
  }
}

function toContractCreateData(input: CreateContractDto, tenantId: string): Prisma.RentalContractUncheckedCreateInput {
  return {
    tenantId,
    propertyId: input.propertyId,
    ownerId: input.ownerId,
    renterId: input.renterId,
    ...(input.status !== undefined ? { status: input.status } : {}),
    startsAt: toDate(input.startsAt),
    endsAt: toDate(input.endsAt),
    rentAmount: input.rentAmount,
    currency: input.currency,
    dueDayOfMonth: input.dueDayOfMonth,
    adjustmentIndexType: input.adjustmentIndexType,
    adjustmentPeriodMonths: input.adjustmentPeriodMonths,
    ...(input.nextAdjustmentAt !== undefined ? { nextAdjustmentAt: toDate(input.nextAdjustmentAt) } : {})
  };
}

function toContractUpdateData(input: UpdateContractDto): Prisma.RentalContractUncheckedUpdateInput {
  return {
    ...(input.propertyId !== undefined ? { propertyId: input.propertyId } : {}),
    ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
    ...(input.renterId !== undefined ? { renterId: input.renterId } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.startsAt !== undefined ? { startsAt: toDate(input.startsAt) } : {}),
    ...(input.endsAt !== undefined ? { endsAt: toDate(input.endsAt) } : {}),
    ...(input.rentAmount !== undefined ? { rentAmount: input.rentAmount } : {}),
    ...(input.currency !== undefined ? { currency: input.currency } : {}),
    ...(input.dueDayOfMonth !== undefined ? { dueDayOfMonth: input.dueDayOfMonth } : {}),
    ...(input.adjustmentIndexType !== undefined ? { adjustmentIndexType: input.adjustmentIndexType } : {}),
    ...(input.adjustmentPeriodMonths !== undefined ? { adjustmentPeriodMonths: input.adjustmentPeriodMonths } : {}),
    ...(input.nextAdjustmentAt !== undefined ? { nextAdjustmentAt: toDate(input.nextAdjustmentAt) } : {})
  };
}

function toDate(value: string): Date {
  return new Date(value);
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

/**
 * Builds a list of changed field keys from the update input.
 * Excludes relation IDs (propertyId, ownerId, renterId) to avoid leaking
 * cross-entity references in audit metadata. Based on provided keys only
 * (no raw DTO dumping or operator-precedence-prone date comparisons).
 */
function buildChangedFields(input: UpdateContractDto): string[] {
  const excludeKeys = new Set(["propertyId", "ownerId", "renterId"]);
  return Object.keys(input).filter((k) => !excludeKeys.has(k));
}
