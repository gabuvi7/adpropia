export interface LegacyRentalBackfillMigrationPlan {
  legacySources: string[];
  newTargets: string[];
  safetyChecks: string[];
  legalEntityBackfill: string;
  destructiveDropAllowed: boolean;
}

export function buildLegacyRentalBackfillMigrationPlan(): LegacyRentalBackfillMigrationPlan {
  return {
    legacySources: ["owners", "renters", "properties.ownerId", "rental_contracts.ownerId", "rental_contracts.renterId", "payments"],
    newTargets: ["personas", "persona_fisicas", "property_owners", "contract_participants", "contract_properties", "rent_periods", "rent_payments"],
    safetyChecks: [
      "tenant-scoped-persona-mapping",
      "no-cross-tenant-owner-property-links",
      "no-cross-tenant-contract-party-links",
      "legacy-payment-contract-renter-consistency"
    ],
    legalEntityBackfill:
      "Legacy owners/renters do not distinguish physical from legal persons, so this migration only creates persona_fisicas. Persona juridicas must be created through the new model/API.",
    destructiveDropAllowed: false
  };
}
