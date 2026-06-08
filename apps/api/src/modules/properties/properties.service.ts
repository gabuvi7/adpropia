import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, Property } from "@adpropia/database";
import { buildChangedFieldsMetadata } from "@adpropia/shared";
import { PrismaService } from "../../common/prisma";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { AuditService } from "../audit/audit.service";
import type { CreatePropertyDto, UpdatePropertyDto } from "./properties.dto";

export type PropertyRecord = Property;

export interface PropertyOwnerParticipationDto {
  personaId: string;
  /** Ownership share in basis points; 100% = 10_000 bps. */
  ownershipShareBps: number;
}

export interface PropertyServiceLinkDto {
  serviceTypeId: string;
  accountNumber?: string | undefined;
}

export interface CreatePropertyUnitDto {
  propertyTypeId: string;
  addressLine: string;
  status?: "AVAILABLE" | "RENTED" | "INACTIVE" | undefined;
  buildingName?: string | undefined;
  city?: string | undefined;
  province?: string | undefined;
  postalCode?: string | undefined;
  commissionBps?: number | undefined;
  owners: PropertyOwnerParticipationDto[];
  services?: PropertyServiceLinkDto[] | undefined;
}

@Injectable()
export class PropertiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contextService: RequestContextService,
    private readonly audit: AuditService
  ) {}

  async createProperty(input: CreatePropertyDto): Promise<PropertyRecord> {
    const ctx = this.contextService.get();
    const { tenantId } = ctx;
    await this.ensureOwnerBelongsToTenant(input.ownerId, tenantId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const property = await tx.property.create({
          data: toPropertyCreateData(input, tenantId)
        });

        await this.audit.createEntryWithClient(tx, ctx, {
          entityType: "property",
          entityId: property.id,
          action: "property.created",
          metadata: { ownerId: input.ownerId }
        });

        return property;
      });
    } catch {
      throw new BadRequestException("No pudimos crear la propiedad. Revisá los datos enviados.");
    }
  }

  async createPropertyUnit(input: CreatePropertyUnitDto): Promise<PropertyRecord> {
    const ctx = this.contextService.get();
    const { tenantId } = ctx;
    assertOwnershipTotals(input.owners);

    const propertyType = await this.ensurePropertyTypeExists(input.propertyTypeId);
    await this.ensurePersonasBelongToTenant(
      input.owners.map((owner) => owner.personaId),
      tenantId
    );
    const services = input.services ?? [];
    await this.ensureServiceTypesExist(services.map((service) => service.serviceTypeId));

    try {
      return await this.prisma.$transaction(async (tx) => {
        const property = await tx.property.create({
          data: toPropertyUnitCreateData(input, tenantId, propertyType.code)
        });

        await tx.propertyOwner.createMany({
          data: toPropertyOwnerCreateManyData(input.owners, property.id, tenantId)
        });

        if (services.length > 0) {
          await tx.propertyService.createMany({
            data: toPropertyServiceCreateManyData(services, property.id, tenantId)
          });
        }

        await this.audit.createEntryWithClient(tx, ctx, {
          entityType: "property",
          entityId: property.id,
          action: "property.created",
          metadata: { ownerPersonaIds: input.owners.map((owner) => owner.personaId), serviceTypeIds: services.map((service) => service.serviceTypeId) }
        });

        return property;
      });
    } catch {
      throw new BadRequestException("No pudimos crear la unidad funcional. Revisá los datos enviados.");
    }
  }

  listProperties(): Promise<PropertyRecord[]> {
    const { tenantId } = this.contextService.get();
    return this.prisma.property.findMany({ where: { tenantId, deletedAt: null }, orderBy: { addressLine: "asc" } });
  }

  async getPropertyById(id: string): Promise<PropertyRecord> {
    const property = await this.findActiveProperty(id);
    if (!property) {
      throw new NotFoundException("No encontramos la propiedad solicitada.");
    }

    return property;
  }

  findPropertyForTenant(id: string) {
    return this.getPropertyById(id);
  }

  async updateProperty(id: string, input: UpdatePropertyDto): Promise<PropertyRecord> {
    const ctx = this.contextService.get();
    const { tenantId } = ctx;
    const property = await this.findActiveProperty(id, tenantId);

    if (!property) {
      throw new NotFoundException("No encontramos la propiedad solicitada.");
    }

    if (input.ownerId !== undefined) {
      await this.ensureOwnerBelongsToTenant(input.ownerId, tenantId);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.property.update({
          where: { id_tenantId: { id, tenantId } },
          data: toPropertyUpdateData(input)
        });

        await this.audit.createEntryWithClient(tx, ctx, {
          entityType: "property",
          entityId: id,
          action: "property.updated",
          metadata: buildChangedFieldsMetadata(input)
        });

        return updated;
      });
    } catch {
      throw new BadRequestException("No pudimos actualizar la propiedad. Revisá los datos enviados.");
    }
  }

  async updatePropertyOwnership(id: string, owners: PropertyOwnerParticipationDto[]): Promise<void> {
    const ctx = this.contextService.get();
    const { tenantId } = ctx;
    assertOwnershipTotals(owners);

    const property = await this.findActiveProperty(id, tenantId);
    if (!property) {
      throw new NotFoundException("No encontramos la propiedad solicitada.");
    }

    await this.ensurePropertyHasNoActiveContract(id, tenantId);
    await this.ensurePersonasBelongToTenant(
      owners.map((owner) => owner.personaId),
      tenantId
    );

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.propertyOwner.deleteMany({ where: { tenantId, propertyId: id } });
        await tx.propertyOwner.createMany({ data: toPropertyOwnerCreateManyData(owners, id, tenantId) });

        await this.audit.createEntryWithClient(tx, ctx, {
          entityType: "property",
          entityId: id,
          action: "property.ownership_updated",
          metadata: { ownerPersonaIds: owners.map((owner) => owner.personaId) }
        });
      });
    } catch {
      throw new BadRequestException("No pudimos actualizar los propietarios de la propiedad. Revisá los datos enviados.");
    }
  }

  private findActiveProperty(id: string, tenantId = this.contextService.get().tenantId): Promise<PropertyRecord | null> {
    return this.prisma.property.findFirst({ where: { id, tenantId, deletedAt: null } });
  }

  private async ensureOwnerBelongsToTenant(ownerId: string, tenantId: string): Promise<void> {
    const owner = await this.prisma.owner.findFirst({ where: { id: ownerId, tenantId, deletedAt: null } });
    if (!owner) {
      throw new BadRequestException("El propietario indicado no existe en esta inmobiliaria.");
    }
  }

  private async ensurePropertyHasNoActiveContract(propertyId: string, tenantId: string): Promise<void> {
    const activeContracts = await this.prisma.rentalContract.count({ where: { tenantId, propertyId, status: "ACTIVE" } });
    if (activeContracts > 0) {
      throw new BadRequestException("No podés cambiar la titularidad mientras haya un contrato activo asociado a la propiedad.");
    }
  }

  private async ensurePersonasBelongToTenant(personaIds: string[], tenantId: string): Promise<void> {
    const uniquePersonaIds = [...new Set(personaIds)];
    const personas = await this.prisma.persona.findMany({ where: { tenantId, id: { in: uniquePersonaIds }, deletedAt: null }, select: { id: true } });
    if (personas.length !== uniquePersonaIds.length) {
      throw new BadRequestException("Todos los propietarios deben pertenecer a esta inmobiliaria.");
    }
  }

  private async ensurePropertyTypeExists(propertyTypeId: string): Promise<{ code: PropertyTypeCode }> {
    const propertyType = await this.prisma.propertyTypeCatalog.findFirst({ where: { id: propertyTypeId, isActive: true }, select: { code: true } });
    if (!propertyType || !isPropertyTypeCode(propertyType.code)) {
      throw new BadRequestException("El tipo de propiedad indicado no existe.");
    }

    return { code: propertyType.code };
  }

  private async ensureServiceTypesExist(serviceTypeIds: string[]): Promise<void> {
    const uniqueServiceTypeIds = [...new Set(serviceTypeIds)];
    if (uniqueServiceTypeIds.length === 0) {
      return;
    }

    const serviceTypes = await this.prisma.serviceType.findMany({ where: { id: { in: uniqueServiceTypeIds }, isActive: true }, select: { id: true } });
    if (serviceTypes.length !== uniqueServiceTypeIds.length) {
      throw new BadRequestException("Todos los servicios indicados deben existir en el catálogo global.");
    }
  }
}

type PropertyTypeCode = "APARTMENT" | "HOUSE" | "COMMERCIAL" | "LAND" | "OTHER";

const PROPERTY_TYPE_CODES = new Set<PropertyTypeCode>(["APARTMENT", "HOUSE", "COMMERCIAL", "LAND", "OTHER"]);

function isPropertyTypeCode(code: string): code is PropertyTypeCode {
  return PROPERTY_TYPE_CODES.has(code as PropertyTypeCode);
}

function assertOwnershipTotals(owners: PropertyOwnerParticipationDto[]): void {
  const total = owners.reduce((sum, owner) => sum + owner.ownershipShareBps, 0);
  if (owners.length === 0 || total !== 10000) {
    throw new BadRequestException("La participación de los propietarios debe sumar 100%.");
  }
}

function toPropertyCreateData(input: CreatePropertyDto, tenantId: string): Prisma.PropertyUncheckedCreateInput {
  return {
    tenantId,
    ownerId: input.ownerId,
    type: input.type,
    addressLine: input.addressLine,
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.city !== undefined ? { city: input.city } : {}),
    ...(input.province !== undefined ? { province: input.province } : {}),
    ...(input.postalCode !== undefined ? { postalCode: input.postalCode } : {}),
    ...(input.commissionBps !== undefined ? { commissionBps: input.commissionBps } : {})
  };
}

function toPropertyUnitCreateData(input: CreatePropertyUnitDto, tenantId: string, type: PropertyTypeCode): Prisma.PropertyUncheckedCreateInput {
  return {
    tenantId,
    propertyTypeId: input.propertyTypeId,
    type,
    addressLine: input.addressLine,
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.buildingName !== undefined ? { buildingName: input.buildingName } : {}),
    ...(input.city !== undefined ? { city: input.city } : {}),
    ...(input.province !== undefined ? { province: input.province } : {}),
    ...(input.postalCode !== undefined ? { postalCode: input.postalCode } : {}),
    ...(input.commissionBps !== undefined ? { commissionBps: input.commissionBps } : {})
  };
}

function toPropertyOwnerCreateManyData(owners: PropertyOwnerParticipationDto[], propertyId: string, tenantId: string) {
  return owners.map((owner) => ({
    tenantId,
    propertyId,
    personaId: owner.personaId,
    ownershipShareBps: owner.ownershipShareBps
  }));
}

function toPropertyServiceCreateManyData(services: PropertyServiceLinkDto[], propertyId: string, tenantId: string) {
  return services.map((service) => ({
    tenantId,
    propertyId,
    serviceTypeId: service.serviceTypeId,
    accountNumber: service.accountNumber ?? null
  }));
}

function toPropertyUpdateData(input: UpdatePropertyDto): Prisma.PropertyUncheckedUpdateInput {
  return {
    ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.addressLine !== undefined ? { addressLine: input.addressLine } : {}),
    ...(input.city !== undefined ? { city: input.city } : {}),
    ...(input.province !== undefined ? { province: input.province } : {}),
    ...(input.postalCode !== undefined ? { postalCode: input.postalCode } : {}),
    ...(input.commissionBps !== undefined ? { commissionBps: input.commissionBps } : {})
  };
}
