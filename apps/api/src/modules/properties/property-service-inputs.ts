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
