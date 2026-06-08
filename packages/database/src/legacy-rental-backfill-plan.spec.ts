import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildLegacyRentalBackfillMigrationPlan } from "./legacy-rental-backfill-plan";

const MIGRATION_SQL = readFileSync(
  join(process.cwd(), "prisma/migrations/20260608000000_legacy_rental_backfill_safety/migration.sql"),
  "utf8"
);

describe("legacy rental backfill migration plan", () => {
  it("backfills owners, renters, contracts, and legacy payments through tenant-scoped joins", () => {
    const plan = buildLegacyRentalBackfillMigrationPlan();

    expect(plan.legacySources).toEqual(["owners", "renters", "properties.ownerId", "rental_contracts.ownerId", "rental_contracts.renterId", "payments"]);
    expect(plan.newTargets).toEqual(["personas", "persona_fisicas", "property_owners", "contract_participants", "contract_properties", "rent_periods", "rent_payments"]);
    expect(plan.safetyChecks).toContain("tenant-scoped-persona-mapping");
    expect(plan.safetyChecks).toContain("no-cross-tenant-owner-property-links");
    expect(plan.safetyChecks).toContain("no-cross-tenant-contract-party-links");
    expect(plan.safetyChecks).toContain("legacy-payment-contract-renter-consistency");
    expect(plan.legalEntityBackfill).toContain("only creates persona_fisicas");
    expect(plan.legalEntityBackfill).toContain("Persona juridicas must be created through the new model/API");
    expect(plan.destructiveDropAllowed).toBe(false);
  });

  it("documents why legacy data is not backfilled into persona juridicas", () => {
    expect(MIGRATION_SQL).toContain("Legacy owners/renters do not distinguish physical from legal persons");
    expect(MIGRATION_SQL).toContain("migration intentionally creates only persona_fisicas");
    expect(MIGRATION_SQL).not.toContain('INSERT INTO "persona_juridicas"');
  });

  it("ships SQL that refuses destructive legacy removal until every legacy row is mapped", () => {
    expect(MIGRATION_SQL).toContain("CREATE TABLE IF NOT EXISTS \"legacy_rental_backfill_mappings\"");
    expect(MIGRATION_SQL).toMatch(/"source_table" IN \('owners', 'renters', 'properties', 'rental_contracts', 'payments'\)/);
    expect(MIGRATION_SQL).toContain("RAISE EXCEPTION 'Legacy rental backfill blocked: % unmapped rows remain before destructive removal.'");
    expect(MIGRATION_SQL).not.toMatch(/DROP\s+TABLE\s+"?(owners|renters|payments)"?/i);
    expect(MIGRATION_SQL).not.toMatch(/DROP\s+COLUMN\s+"?(ownerId|renterId)"?/i);
  });

  it("fail-fast validates legacy payment renters against their rental contract before payment-dependent backfills", () => {
    const mismatchGuardIndex = MIGRATION_SQL.indexOf("p.\"renterId\" IS DISTINCT FROM rc.\"renterId\"");
    const rentPeriodBackfillIndex = MIGRATION_SQL.indexOf("INSERT INTO \"rent_periods\"");

    expect(mismatchGuardIndex).toBeGreaterThan(-1);
    expect(mismatchGuardIndex).toBeLessThan(rentPeriodBackfillIndex);
    expect(MIGRATION_SQL).toMatch(
      /FROM\s+"payments"\s+p\s+JOIN\s+"rental_contracts"\s+rc\s+ON\s+rc\."id"\s+=\s+p\."contractId"\s+AND\s+rc\."tenantId"\s+=\s+p\."tenantId"\s+WHERE\s+p\."renterId"\s+IS\s+DISTINCT\s+FROM\s+rc\."renterId"/
    );
    expect(MIGRATION_SQL).toContain(
      "RAISE EXCEPTION 'Legacy rental backfill blocked: % payments have renterId that does not match rental_contracts.renterId.'"
    );
  });

  it("hardens the internal legacy mapping table against application-role reads", () => {
    expect(MIGRATION_SQL).toContain('ALTER TABLE "legacy_rental_backfill_mappings" ENABLE ROW LEVEL SECURITY;');
    expect(MIGRATION_SQL).toContain('REVOKE ALL ON TABLE "legacy_rental_backfill_mappings" FROM anon, authenticated;');
  });

  it("prevents cross-tenant persona sharing in every relationship backfill", () => {
    expect(MIGRATION_SQL).toMatch(/JOIN\s+"legacy_rental_backfill_mappings"\s+owner_map[\s\S]+owner_map\."tenantId"\s+=\s+p\."tenantId"/);
    expect(MIGRATION_SQL).toMatch(/JOIN\s+"legacy_rental_backfill_mappings"\s+renter_map[\s\S]+renter_map\."tenantId"\s+=\s+rc\."tenantId"/);
    expect(MIGRATION_SQL).toMatch(/JOIN\s+"rental_contracts"\s+rc[\s\S]+rc\."tenantId"\s+=\s+p\."tenantId"/);
    expect(MIGRATION_SQL).toMatch(/JOIN\s+"rent_periods"\s+rp[\s\S]+rp\."tenantId"\s+=\s+p\."tenantId"/);
  });

  it("groups legacy payment rows into one rent period per tenant contract and month", () => {
    expect(MIGRATION_SQL).toContain('SELECT DISTINCT ON (p."tenantId", p."contractId", date_trunc(\'month\', p."dueAt"))');
    expect(MIGRATION_SQL).toContain("'legacy_rent_period_' || p.\"contractId\" || '_' || to_char(date_trunc('month', p.\"dueAt\"), 'YYYYMMDD')");
    expect(MIGRATION_SQL).not.toContain("'legacy_payment_period_' || p.\"id\"");
  });
});
