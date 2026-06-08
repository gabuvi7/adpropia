import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, RentalContract, RentalContractStatus } from "@adpropia/database";
import { PrismaService } from "../../common/prisma";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { AuditService } from "../audit/audit.service";
import type { CreateContractDto, UpdateContractDto } from "./contracts.dto";

export type ContractRecord = RentalContract;

export interface ContractPropertyInput {
  propertyId: string;
  monthlyAmount?: string;
}

export interface CreateContractStructureDto {
  participantPersonaIds: string[];
  properties: ContractPropertyInput[];
  status?: "DRAFT" | "PENDING_SIGNATURE" | "ACTIVE" | "FINALIZED" | "FINISHED" | "CANCELLED";
  startsAt: string;
  endsAt: string;
  monthlyTotalAmount: string;
  currency: "ARS" | "USD";
  dueDayOfMonth: number;
  adjustmentIndexType: "IPC" | "ICL" | "UVA" | "FIXED" | "CUSTOM";
  adjustmentPeriodMonths: number;
  nextAdjustmentAt?: string;
  commissionBps: number;
  previousContractId?: string;
}

export interface FinalizeContractEarlyDto {
  finalizedAt: string;
  finalizationReason: "MUTUAL_AGREEMENT" | "TENANT_BREACH" | "OWNER_DECISION" | "OTHER";
  finalizationDescription?: string;
}

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

  async createContractStructure(input: CreateContractStructureDto): Promise<ContractRecord> {
    const ctx = this.contextService.get();
    const { tenantId } = ctx;
    const propertyIds = input.properties.map((property) => property.propertyId);
    assertUniqueIds(propertyIds, "No podés incluir la misma propiedad más de una vez en el contrato.");
    assertUniqueIds(input.participantPersonaIds, "No podés incluir el mismo participante más de una vez en el contrato.");
    assertMonthlyAllocations(input.properties, input.monthlyTotalAmount);

    await this.ensurePropertiesBelongToTenant(propertyIds, tenantId);
    await this.ensurePersonasBelongToTenant(input.participantPersonaIds, tenantId);
    await this.ensureContractPropertiesShareOwnership(propertyIds, tenantId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const contract = await tx.rentalContract.create({ data: toContractStructureCreateData(input, tenantId) });

        await tx.contractParticipant.createMany({
          data: input.participantPersonaIds.map((personaId) => ({ tenantId, contractId: contract.id, personaId }))
        });

        await tx.contractProperty.createMany({
          data: input.properties.map((property) => ({
            tenantId,
            contractId: contract.id,
            propertyId: property.propertyId,
            monthlyAmount: property.monthlyAmount ?? null
          }))
        });

        await this.audit.createEntryWithClient(tx, ctx, {
          entityType: "contract",
          entityId: contract.id,
          action: "contract.structure_created",
          metadata: { propertyIds, participantPersonaIds: input.participantPersonaIds }
        });

        return contract;
      });
    } catch {
      throw new BadRequestException("No pudimos crear la estructura del contrato. Revisá los datos enviados.");
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
    if (!propertyId || !ownerId || !renterId) {
      throw new BadRequestException("Este contrato necesita propiedad, propietario e inquilino para actualizarse por esta vía.");
    }
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

  async finalizeContractEarly(id: string, input: FinalizeContractEarlyDto): Promise<ContractRecord> {
    if (input.finalizationReason === "OTHER" && !input.finalizationDescription?.trim()) {
      throw new BadRequestException("Tenés que indicar una descripción cuando el motivo de finalización es Otro.");
    }

    const ctx = this.contextService.get();
    const { tenantId } = ctx;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const contract = await tx.rentalContract.update({
          where: { id_tenantId: { id, tenantId } },
          data: {
            status: "FINALIZED",
            finalizedAt: toDate(input.finalizedAt),
            finalizationReason: input.finalizationReason,
            finalizationDescription: input.finalizationDescription?.trim() ?? null
          }
        });

        await this.audit.createEntryWithClient(tx, ctx, {
          entityType: "contract",
          entityId: id,
          action: "contract.early_finalized",
          metadata: { finalizationReason: input.finalizationReason }
        });

        return contract;
      });
    } catch (error) {
      if (hasPrismaCode(error, "P2025")) {
        throw new NotFoundException("No encontramos el contrato solicitado.");
      }

      throw new BadRequestException("No pudimos finalizar anticipadamente el contrato. Revisá los datos enviados.");
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

  private async ensurePropertiesBelongToTenant(propertyIds: string[], tenantId: string): Promise<void> {
    const properties = await Promise.all(
      propertyIds.map((propertyId) => this.prisma.property.findFirst({ where: { id: propertyId, tenantId, deletedAt: null } }))
    );

    if (properties.some((property) => !property)) {
      throw new BadRequestException("Todas las propiedades del contrato deben pertenecer a esta inmobiliaria.");
    }
  }

  private async ensurePersonasBelongToTenant(personaIds: string[], tenantId: string): Promise<void> {
    const personas = await this.prisma.persona.findMany({ where: { tenantId, id: { in: personaIds }, deletedAt: null }, select: { id: true } });
    if (personas.length !== personaIds.length) {
      throw new BadRequestException("Todos los participantes del contrato deben pertenecer a esta inmobiliaria.");
    }
  }

  private async ensureContractPropertiesShareOwnership(propertyIds: string[], tenantId: string): Promise<void> {
    const ownershipSignatures = await Promise.all(
      propertyIds.map(async (propertyId) => {
        const owners = await this.prisma.propertyOwner.findMany({
          where: { tenantId, propertyId },
          select: { personaId: true, ownershipShareBps: true },
          orderBy: { personaId: "asc" }
        });

        return buildOwnershipSignature(owners);
      })
    );

    const [firstSignature, ...remainingSignatures] = ownershipSignatures;
    if (!firstSignature || remainingSignatures.some((signature) => signature !== firstSignature)) {
      throw new BadRequestException("Todas las propiedades del contrato deben compartir el mismo grupo de propietarios y porcentajes de titularidad.");
    }
  }
}

interface OwnershipSignatureItem {
  personaId: string;
  ownershipShareBps: number;
}

function buildOwnershipSignature(owners: OwnershipSignatureItem[]): string {
  if (owners.length === 0) {
    throw new BadRequestException("Todas las propiedades del contrato deben tener propietarios vigentes.");
  }

  return owners
    .map((owner) => `${owner.personaId}:${owner.ownershipShareBps}`)
    .sort()
    .join("|");
}

function assertUniqueIds(ids: string[], message: string): void {
  if (ids.length === 0 || new Set(ids).size !== ids.length) {
    throw new BadRequestException(message);
  }
}

function assertMonthlyAllocations(properties: ContractPropertyInput[], monthlyTotalAmount: string): void {
  const allocated = properties.filter((property) => property.monthlyAmount !== undefined);
  if (allocated.length === 0) {
    return;
  }

  if (allocated.length !== properties.length) {
    throw new BadRequestException("Tenés que indicar importes mensuales para todas las propiedades o no indicar ninguno.");
  }

  const totalCents = toCents(monthlyTotalAmount);
  const allocatedCents = allocated.reduce((sum, property) => sum + toCents(property.monthlyAmount ?? "0"), 0);
  if (allocatedCents !== totalCents) {
    throw new BadRequestException("La suma de los importes mensuales por propiedad debe coincidir con el total mensual del contrato.");
  }
}

function toCents(value: string): number {
  const [units = "0", cents = ""] = value.split(".");
  return Number(units) * 100 + Number(cents.padEnd(2, "0").slice(0, 2));
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

function toContractStructureCreateData(input: CreateContractStructureDto, tenantId: string): Prisma.RentalContractUncheckedCreateInput {
  const [firstProperty] = input.properties;
  if (!firstProperty) {
    throw new BadRequestException("Tenés que indicar al menos una propiedad para el contrato.");
  }

  return {
    tenantId,
    propertyId: firstProperty.propertyId,
    status: input.status ?? "PENDING_SIGNATURE",
    startsAt: toDate(input.startsAt),
    endsAt: toDate(input.endsAt),
    rentAmount: input.monthlyTotalAmount,
    monthlyTotalAmount: input.monthlyTotalAmount,
    currency: input.currency,
    dueDayOfMonth: input.dueDayOfMonth,
    adjustmentIndexType: input.adjustmentIndexType,
    adjustmentPeriodMonths: input.adjustmentPeriodMonths,
    commissionBps: input.commissionBps,
    ...(input.nextAdjustmentAt !== undefined ? { nextAdjustmentAt: toDate(input.nextAdjustmentAt) } : {}),
    ...(input.previousContractId !== undefined ? { previousContractId: input.previousContractId } : {})
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
