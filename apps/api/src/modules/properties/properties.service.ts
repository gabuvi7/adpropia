import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Property } from "@adpropia/database";
import { buildChangedFieldsMetadata } from "@adpropia/shared";
import { PrismaService } from "../../common/prisma";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { AuditService } from "../audit/audit.service";
import type { CreatePropertyDto, UpdatePropertyDto } from "./properties.dto";
import { assertOwnershipTotals } from "./property-ownership";
import type { CreatePropertyUnitDto, PropertyOwnerParticipationDto } from "./property-service-inputs";
import {
  toPropertyCreateData,
  toPropertyOwnerCreateManyData,
  toPropertyServiceCreateManyData,
  toPropertyUnitCreateData,
  toPropertyUpdateData
} from "./property-mappers";
import {
  activeContractStatusInclude,
  getOperationalPropertyStatus,
  isOperationalStatusChange,
  toOperationalPropertyStatus,
  type PropertyWithActiveContracts,
  withActiveContractsFromPersistedProperty
} from "./property-status";
import { isPropertyTypeCode, type PropertyTypeCode } from "./property-types";

export type PropertyRecord = Property;

@Injectable()
export class PropertiesService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(RequestContextService)
    private readonly contextService: RequestContextService,
    @Inject(AuditService)
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

  async listProperties(): Promise<PropertyRecord[]> {
    const { tenantId } = this.contextService.get();
    const properties = await this.prisma.property.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { addressLine: "asc" },
      include: activeContractStatusInclude
    });

    return properties.map(toOperationalPropertyStatus);
  }

  async getPropertyById(id: string): Promise<PropertyRecord> {
    const property = await this.findActiveProperty(id);
    if (!property) {
      throw new NotFoundException("No encontramos la propiedad solicitada.");
    }

    return toOperationalPropertyStatus(property);
  }

  findPropertyForTenant(id: string) {
    return this.getPropertyById(id);
  }

  async updateProperty(id: string, input: UpdatePropertyDto): Promise<PropertyRecord> {
    const ctx = this.contextService.get();
    const { tenantId } = ctx;
    const persistedProperty = await this.findActiveProperty(id, tenantId);

    if (!persistedProperty) {
      throw new NotFoundException("No encontramos la propiedad solicitada.");
    }

    const previousOperationalStatus = getOperationalPropertyStatus(persistedProperty);

    if (input.ownerId !== undefined) {
      await this.ensureOwnerBelongsToTenant(input.ownerId, tenantId);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updatedPersistedProperty = await tx.property.update({
          where: { id_tenantId: { id, tenantId } },
          data: toPropertyUpdateData(input)
        });

        const updatedPropertyWithActiveContracts = withActiveContractsFromPersistedProperty(updatedPersistedProperty, persistedProperty);
        const nextOperationalStatus = getOperationalPropertyStatus(updatedPropertyWithActiveContracts);

        await this.audit.createEntryWithClient(tx, ctx, {
          entityType: "property",
          entityId: id,
          action: "property.updated",
          metadata: buildChangedFieldsMetadata(input)
        });

        if (isOperationalStatusChange(previousOperationalStatus, nextOperationalStatus)) {
          await this.audit.createEntryWithClient(tx, ctx, {
            entityType: "property",
            entityId: id,
            action: "property.status.changed",
            metadata: { from: previousOperationalStatus, to: nextOperationalStatus }
          });
        }

        return toOperationalPropertyStatus(updatedPropertyWithActiveContracts);
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

  private findActiveProperty(id: string, tenantId = this.contextService.get().tenantId): Promise<PropertyWithActiveContracts | null> {
    return this.prisma.property.findFirst({ where: { id, tenantId, deletedAt: null }, include: activeContractStatusInclude });
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
