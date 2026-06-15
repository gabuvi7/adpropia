import type { Prisma } from "@adpropia/database";
import type { CreatePropertyDto, UpdatePropertyDto } from "./properties.dto";
import type { CreatePropertyUnitDto, PropertyOwnerParticipationDto, PropertyServiceLinkDto } from "./property-service-inputs";
import type { PropertyTypeCode } from "./property-types";

export function toPropertyCreateData(input: CreatePropertyDto, tenantId: string): Prisma.PropertyUncheckedCreateInput {
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

export function toPropertyUnitCreateData(input: CreatePropertyUnitDto, tenantId: string, type: PropertyTypeCode): Prisma.PropertyUncheckedCreateInput {
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

export function toPropertyOwnerCreateManyData(owners: PropertyOwnerParticipationDto[], propertyId: string, tenantId: string) {
  return owners.map((owner) => ({
    tenantId,
    propertyId,
    personaId: owner.personaId,
    ownershipShareBps: owner.ownershipShareBps
  }));
}

export function toPropertyServiceCreateManyData(services: PropertyServiceLinkDto[], propertyId: string, tenantId: string) {
  return services.map((service) => ({
    tenantId,
    propertyId,
    serviceTypeId: service.serviceTypeId,
    accountNumber: service.accountNumber ?? null
  }));
}

export function toPropertyUpdateData(input: UpdatePropertyDto): Prisma.PropertyUncheckedUpdateInput {
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
