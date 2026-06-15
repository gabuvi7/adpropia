import { BadRequestException } from "@nestjs/common";
import type { PropertyOwnerParticipationDto } from "./property-service-inputs";

const FULL_OWNERSHIP_BASIS_POINTS = 10000;

export function assertOwnershipTotals(owners: PropertyOwnerParticipationDto[]): void {
  const totalOwnershipBasisPoints = owners.reduce((sum, owner) => sum + owner.ownershipShareBps, 0);

  if (owners.length === 0 || totalOwnershipBasisPoints !== FULL_OWNERSHIP_BASIS_POINTS) {
    throw new BadRequestException("La participación de los propietarios debe sumar 100%.");
  }
}
