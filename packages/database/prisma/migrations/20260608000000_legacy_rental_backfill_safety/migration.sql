-- Legacy rental backfill safety foundation.
--
-- This migration intentionally does NOT drop legacy rental tables or columns.
-- It creates deterministic tenant-scoped mappings and backfills the new Persona,
-- property ownership, structured contract, rent period, and rent payment tables.
-- Legacy owners/renters do not distinguish physical from legal persons, so this
-- migration intentionally creates only persona_fisicas. Legal entities must be
-- created through the new model/API instead of inferred during backfill.
-- Destructive legacy removal is blocked until the verification DO block proves
-- every legacy row that can be migrated has a tenant-scoped target mapping.

CREATE TABLE IF NOT EXISTS "legacy_rental_backfill_mappings" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "source_table" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "target_table" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "legacy_rental_backfill_mappings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "legacy_rental_backfill_mappings_source_table_check" CHECK ("source_table" IN ('owners', 'renters', 'properties', 'rental_contracts', 'payments')),
  CONSTRAINT "legacy_rental_backfill_mappings_target_table_check" CHECK ("target_table" IN ('personas', 'property_owners', 'contract_participants', 'contract_properties', 'rent_periods', 'rent_payments'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "legacy_rental_backfill_mappings_source_key"
  ON "legacy_rental_backfill_mappings"("tenantId", "source_table", "source_id", "target_table");

CREATE INDEX IF NOT EXISTS "legacy_rental_backfill_mappings_target_idx"
  ON "legacy_rental_backfill_mappings"("tenantId", "target_table", "target_id");

ALTER TABLE "legacy_rental_backfill_mappings" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "legacy_rental_backfill_mappings" FROM anon, authenticated;

ALTER TABLE "legacy_rental_backfill_mappings"
  ADD CONSTRAINT "legacy_rental_backfill_mappings_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "personas" ("id", "tenantId", "kind", "displayName", "email", "phone", "deletedAt", "createdAt", "updatedAt")
SELECT
  'legacy_owner_' || o."id",
  o."tenantId",
  'FISICA'::"PersonaKind",
  o."displayName",
  o."email",
  o."phone",
  o."deletedAt",
  o."createdAt",
  o."updatedAt"
FROM "owners" o
WHERE NOT EXISTS (
  SELECT 1
  FROM "personas" existing
  WHERE existing."id" = 'legacy_owner_' || o."id"
    AND existing."tenantId" = o."tenantId"
);

INSERT INTO "persona_fisicas" ("id", "tenantId", "personaId", "firstName", "lastName", "dni", "cuit", "createdAt", "updatedAt")
SELECT
  'legacy_owner_fisica_' || o."id",
  o."tenantId",
  'legacy_owner_' || o."id",
  o."displayName",
  NULL,
  NULL,
  COALESCE(NULLIF(o."taxId", ''), 'LEGACY-OWNER-' || o."id"),
  o."createdAt",
  o."updatedAt"
FROM "owners" o
WHERE NOT EXISTS (
  SELECT 1
  FROM "persona_fisicas" existing
  WHERE existing."personaId" = 'legacy_owner_' || o."id"
    AND existing."tenantId" = o."tenantId"
);

INSERT INTO "legacy_rental_backfill_mappings" ("id", "tenantId", "source_table", "source_id", "target_table", "target_id")
SELECT
  'legacy_owner_persona_' || o."tenantId" || '_' || o."id",
  o."tenantId",
  'owners',
  o."id",
  'personas',
  'legacy_owner_' || o."id"
FROM "owners" o
ON CONFLICT ("tenantId", "source_table", "source_id", "target_table") DO NOTHING;

INSERT INTO "personas" ("id", "tenantId", "kind", "displayName", "email", "phone", "deletedAt", "createdAt", "updatedAt")
SELECT
  'legacy_renter_' || r."id",
  r."tenantId",
  'FISICA'::"PersonaKind",
  r."displayName",
  r."email",
  r."phone",
  r."deletedAt",
  r."createdAt",
  r."updatedAt"
FROM "renters" r
WHERE NOT EXISTS (
  SELECT 1
  FROM "personas" existing
  WHERE existing."id" = 'legacy_renter_' || r."id"
    AND existing."tenantId" = r."tenantId"
);

INSERT INTO "persona_fisicas" ("id", "tenantId", "personaId", "firstName", "lastName", "dni", "cuit", "createdAt", "updatedAt")
SELECT
  'legacy_renter_fisica_' || r."id",
  r."tenantId",
  'legacy_renter_' || r."id",
  r."displayName",
  NULL,
  COALESCE(NULLIF(r."identityNumber", ''), 'LEGACY-RENTER-' || r."id"),
  NULL,
  r."createdAt",
  r."updatedAt"
FROM "renters" r
WHERE NOT EXISTS (
  SELECT 1
  FROM "persona_fisicas" existing
  WHERE existing."personaId" = 'legacy_renter_' || r."id"
    AND existing."tenantId" = r."tenantId"
);

INSERT INTO "legacy_rental_backfill_mappings" ("id", "tenantId", "source_table", "source_id", "target_table", "target_id")
SELECT
  'legacy_renter_persona_' || r."tenantId" || '_' || r."id",
  r."tenantId",
  'renters',
  r."id",
  'personas',
  'legacy_renter_' || r."id"
FROM "renters" r
ON CONFLICT ("tenantId", "source_table", "source_id", "target_table") DO NOTHING;

INSERT INTO "property_owners" ("id", "tenantId", "propertyId", "personaId", "ownershipShareBps", "createdAt", "updatedAt")
SELECT
  'legacy_property_owner_' || p."id",
  p."tenantId",
  p."id",
  owner_map."target_id",
  10000,
  p."createdAt",
  p."updatedAt"
FROM "properties" p
JOIN "legacy_rental_backfill_mappings" owner_map
  ON owner_map."tenantId" = p."tenantId"
 AND owner_map."source_table" = 'owners'
 AND owner_map."source_id" = p."ownerId"
 AND owner_map."target_table" = 'personas'
WHERE p."ownerId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "property_owners" existing
    WHERE existing."tenantId" = p."tenantId"
      AND existing."propertyId" = p."id"
      AND existing."personaId" = owner_map."target_id"
  );

INSERT INTO "legacy_rental_backfill_mappings" ("id", "tenantId", "source_table", "source_id", "target_table", "target_id")
SELECT
  'legacy_property_owner_mapping_' || p."tenantId" || '_' || p."id",
  p."tenantId",
  'properties',
  p."id",
  'property_owners',
  'legacy_property_owner_' || p."id"
FROM "properties" p
WHERE p."ownerId" IS NOT NULL
ON CONFLICT ("tenantId", "source_table", "source_id", "target_table") DO NOTHING;

INSERT INTO "contract_properties" ("id", "tenantId", "contractId", "propertyId", "monthlyAmount", "createdAt")
SELECT
  'legacy_contract_property_' || rc."id",
  rc."tenantId",
  rc."id",
  rc."propertyId",
  rc."monthlyTotalAmount",
  rc."createdAt"
FROM "rental_contracts" rc
WHERE rc."propertyId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "contract_properties" existing
    WHERE existing."tenantId" = rc."tenantId"
      AND existing."contractId" = rc."id"
      AND existing."propertyId" = rc."propertyId"
  );

INSERT INTO "legacy_rental_backfill_mappings" ("id", "tenantId", "source_table", "source_id", "target_table", "target_id")
SELECT
  'legacy_contract_property_mapping_' || rc."tenantId" || '_' || rc."id",
  rc."tenantId",
  'rental_contracts',
  rc."id",
  'contract_properties',
  'legacy_contract_property_' || rc."id"
FROM "rental_contracts" rc
WHERE rc."propertyId" IS NOT NULL
ON CONFLICT ("tenantId", "source_table", "source_id", "target_table") DO NOTHING;

INSERT INTO "contract_participants" ("id", "tenantId", "contractId", "personaId", "createdAt")
SELECT
  'legacy_contract_participant_' || rc."id",
  rc."tenantId",
  rc."id",
  renter_map."target_id",
  rc."createdAt"
FROM "rental_contracts" rc
JOIN "legacy_rental_backfill_mappings" renter_map
  ON renter_map."tenantId" = rc."tenantId"
 AND renter_map."source_table" = 'renters'
 AND renter_map."source_id" = rc."renterId"
 AND renter_map."target_table" = 'personas'
WHERE rc."renterId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "contract_participants" existing
    WHERE existing."tenantId" = rc."tenantId"
      AND existing."contractId" = rc."id"
      AND existing."personaId" = renter_map."target_id"
  );

INSERT INTO "legacy_rental_backfill_mappings" ("id", "tenantId", "source_table", "source_id", "target_table", "target_id")
SELECT
  'legacy_contract_participant_mapping_' || rc."tenantId" || '_' || rc."id",
  rc."tenantId",
  'rental_contracts',
  rc."id",
  'contract_participants',
  'legacy_contract_participant_' || rc."id"
FROM "rental_contracts" rc
WHERE rc."renterId" IS NOT NULL
ON CONFLICT ("tenantId", "source_table", "source_id", "target_table") DO NOTHING;

DO $$
DECLARE
  mismatched_payment_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO mismatched_payment_count
  FROM "payments" p
  JOIN "rental_contracts" rc
    ON rc."id" = p."contractId"
   AND rc."tenantId" = p."tenantId"
  WHERE p."renterId" IS DISTINCT FROM rc."renterId";

  IF mismatched_payment_count > 0 THEN
    RAISE EXCEPTION 'Legacy rental backfill blocked: % payments have renterId that does not match rental_contracts.renterId.', mismatched_payment_count;
  END IF;
END $$;

INSERT INTO "rent_periods" (
  "id", "tenantId", "contractId", "tenantPersonaId", "periodStart", "periodEnd", "dueAt", "currency",
  "calculationState", "estimatedAmount", "realAmount", "estimatedIndexType", "estimatedIndexValue",
  "estimatedIndexSource", "realIndexValue", "realIndexSource", "reconciledAt", "createdAt", "updatedAt"
)
SELECT DISTINCT ON (p."tenantId", p."contractId", date_trunc('month', p."dueAt"))
  'legacy_rent_period_' || p."contractId" || '_' || to_char(date_trunc('month', p."dueAt"), 'YYYYMMDD'),
  p."tenantId",
  p."contractId",
  renter_map."target_id",
  date_trunc('month', p."dueAt")::timestamp,
  (date_trunc('month', p."dueAt") + INTERVAL '1 month - 1 day')::timestamp,
  p."dueAt",
  p."currency",
  'RECONCILED'::"RentPeriodCalculationState",
  p."dueAmount",
  p."dueAmount",
  rc."adjustmentIndexType",
  NULL,
  'legacy-payment-backfill',
  NULL,
  'legacy-payment-backfill',
  COALESCE(p."paidAt", p."updatedAt"),
  p."createdAt",
  p."updatedAt"
FROM "payments" p
JOIN "rental_contracts" rc
  ON rc."id" = p."contractId"
 AND rc."tenantId" = p."tenantId"
JOIN "legacy_rental_backfill_mappings" renter_map
  ON renter_map."tenantId" = p."tenantId"
 AND renter_map."source_table" = 'renters'
 AND renter_map."source_id" = p."renterId"
 AND renter_map."target_table" = 'personas'
WHERE NOT EXISTS (
  SELECT 1
  FROM "rent_periods" existing
  WHERE existing."id" = 'legacy_rent_period_' || p."contractId" || '_' || to_char(date_trunc('month', p."dueAt"), 'YYYYMMDD')
    AND existing."tenantId" = p."tenantId"
)
ORDER BY p."tenantId", p."contractId", date_trunc('month', p."dueAt"), p."updatedAt" DESC;

INSERT INTO "legacy_rental_backfill_mappings" ("id", "tenantId", "source_table", "source_id", "target_table", "target_id")
SELECT
  'legacy_payment_period_mapping_' || p."tenantId" || '_' || p."id",
  p."tenantId",
  'payments',
  p."id",
  'rent_periods',
  'legacy_rent_period_' || p."contractId" || '_' || to_char(date_trunc('month', p."dueAt"), 'YYYYMMDD')
FROM "payments" p
ON CONFLICT ("tenantId", "source_table", "source_id", "target_table") DO NOTHING;

INSERT INTO "rent_payments" ("id", "tenantId", "rentPeriodId", "type", "amount", "currency", "paidAt", "cashMovementId", "commissionMovementId", "notes", "createdAt")
SELECT
  'legacy_payment_event_' || p."id",
  p."tenantId",
  rp."id",
  'FINAL'::"RentPaymentType",
  p."paidAmount",
  p."currency",
  COALESCE(p."paidAt", p."dueAt"),
  NULL,
  NULL,
  p."notes",
  p."createdAt"
FROM "payments" p
JOIN "rental_contracts" rc
  ON rc."id" = p."contractId"
 AND rc."tenantId" = p."tenantId"
JOIN "rent_periods" rp
  ON rp."id" = 'legacy_rent_period_' || p."contractId" || '_' || to_char(date_trunc('month', p."dueAt"), 'YYYYMMDD')
 AND rp."tenantId" = p."tenantId"
WHERE p."paidAmount" > 0
  AND NOT EXISTS (
    SELECT 1
    FROM "rent_payments" existing
    WHERE existing."id" = 'legacy_payment_event_' || p."id"
      AND existing."tenantId" = p."tenantId"
  );

INSERT INTO "legacy_rental_backfill_mappings" ("id", "tenantId", "source_table", "source_id", "target_table", "target_id")
SELECT
  'legacy_payment_event_mapping_' || p."tenantId" || '_' || p."id",
  p."tenantId",
  'payments',
  p."id",
  'rent_payments',
  'legacy_payment_event_' || p."id"
FROM "payments" p
WHERE p."paidAmount" > 0
ON CONFLICT ("tenantId", "source_table", "source_id", "target_table") DO NOTHING;

DO $$
DECLARE
  unmapped_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO unmapped_count
  FROM (
    SELECT o."tenantId", o."id", 'owners' AS source_table
    FROM "owners" o
    WHERE NOT EXISTS (
      SELECT 1 FROM "legacy_rental_backfill_mappings" m
      WHERE m."tenantId" = o."tenantId" AND m."source_table" = 'owners' AND m."source_id" = o."id" AND m."target_table" = 'personas'
    )
    UNION ALL
    SELECT r."tenantId", r."id", 'renters' AS source_table
    FROM "renters" r
    WHERE NOT EXISTS (
      SELECT 1 FROM "legacy_rental_backfill_mappings" m
      WHERE m."tenantId" = r."tenantId" AND m."source_table" = 'renters' AND m."source_id" = r."id" AND m."target_table" = 'personas'
    )
    UNION ALL
    SELECT p."tenantId", p."id", 'properties' AS source_table
    FROM "properties" p
    WHERE p."ownerId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "legacy_rental_backfill_mappings" m
        WHERE m."tenantId" = p."tenantId" AND m."source_table" = 'properties' AND m."source_id" = p."id" AND m."target_table" = 'property_owners'
      )
    UNION ALL
    SELECT rc."tenantId", rc."id", 'rental_contracts' AS source_table
    FROM "rental_contracts" rc
    WHERE rc."propertyId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "legacy_rental_backfill_mappings" m
        WHERE m."tenantId" = rc."tenantId" AND m."source_table" = 'rental_contracts' AND m."source_id" = rc."id" AND m."target_table" = 'contract_properties'
      )
    UNION ALL
    SELECT rc."tenantId", rc."id", 'rental_contracts' AS source_table
    FROM "rental_contracts" rc
    WHERE rc."renterId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "legacy_rental_backfill_mappings" m
        WHERE m."tenantId" = rc."tenantId" AND m."source_table" = 'rental_contracts' AND m."source_id" = rc."id" AND m."target_table" = 'contract_participants'
      )
    UNION ALL
    SELECT p."tenantId", p."id", 'payments' AS source_table
    FROM "payments" p
    WHERE NOT EXISTS (
      SELECT 1 FROM "legacy_rental_backfill_mappings" m
      WHERE m."tenantId" = p."tenantId" AND m."source_table" = 'payments' AND m."source_id" = p."id" AND m."target_table" = 'rent_periods'
    )
  ) unmapped;

  IF unmapped_count > 0 THEN
    RAISE EXCEPTION 'Legacy rental backfill blocked: % unmapped rows remain before destructive removal.', unmapped_count;
  END IF;
END $$;
