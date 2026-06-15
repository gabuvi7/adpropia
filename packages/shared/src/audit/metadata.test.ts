import { describe, expect, it } from "vitest";
import {
  REDACTED_AUDIT_VALUE,
  buildChangedFieldsMetadata,
  parseAuditMetadata,
  redactAuditMetadata
} from "./metadata";

describe("audit metadata conventions", () => {
  const emittedAuditCases = [
    ["admin-provisioning.auth0-org.linked", undefined],
    ["admin-provisioning.auth0-subject.linked", undefined],
    ["admin-provisioning.membership.provisioned", { userId: "user-1", role: "ADMIN" }],
    ["contract.created", { propertyId: "property-1", ownerId: "owner-1", renterId: "renter-1" }],
    ["contract.deposit_pact_defined", { contractId: "contract-1", currency: "ARS" }],
    ["contract.early_finalized", { finalizationReason: "OTHER" }],
    ["contract.guarantee_registered", { contractId: "contract-1", type: "SURETY", state: "ACTIVE" }],
    ["contract.schedule_activated", { generatedPeriods: 12, estimatedIndexSource: null }],
    ["contract.status.changed", { newStatus: "ACTIVE" }],
    [
      "contract.structure_created",
      { propertyIds: ["property-1", "property-2"], participantPersonaIds: ["persona-1", "persona-2"] }
    ],
    ["contract.updated", { changedFields: [] }],
    ["liquidation.adjustment.added", { concept: "Bonus", amount: "5000.00", sign: "CREDIT" }],
    ["liquidation.adjustment.removed", { adjustmentId: "adjustment-1" }],
    [
      "liquidation.created",
      {
        ownerId: "owner-1",
        periodStart: "2026-01-01",
        periodEnd: "2026-01-31",
        currency: "ARS",
        lineItemsCount: 2,
        adjustmentsCount: 0
      }
    ],
    ["liquidation.status.changed", { from: "DRAFT", to: "ISSUED" }],
    ["owner.created", undefined],
    ["owner.updated", { changedFields: ["name"] }],
    ["payment.created", { contractId: "contract-1", status: "PAID", currency: "ARS" }],
    ["property.created", { ownerPersonaIds: ["persona-1"], serviceTypeIds: [] }],
    ["property.ownership_updated", { ownerPersonaIds: ["persona-1", "persona-2"] }],
    ["property.status.changed", { from: "AVAILABLE", to: "INACTIVE" }],
    ["property.updated", { changedFields: ["status"] }],
    ["rent_payment.recorded", { rentPeriodId: "period-1", type: "ON_ACCOUNT", currency: "ARS" }],
    ["renter.created", undefined],
    ["renter.updated", { changedFields: ["name"] }],
    ["tenant.created", { slug: "tenant-slug", name: "Tenant Name" }],
    ["tenant_settings.updated", { changedFields: ["commercialName", "defaultCommissionBps"] }],
    ["tenant_balance_movement.recorded", { rentPeriodId: "period-1", type: "CREDIT", currency: "ARS" }]
  ] as const;

  it("accepts safe business context for known audit actions", () => {
    const metadata = parseAuditMetadata("property.created", {
      ownerId: "owner-1",
      currency: "ARS",
      amountCents: 125_000,
      changedFields: ["status"]
    });

    expect(metadata).toEqual({
      ownerId: "owner-1",
      currency: "ARS",
      amountCents: 125_000,
      changedFields: ["status"]
    });
  });

  it.each(emittedAuditCases)("accepts currently emitted audit metadata for %s", (action, metadata) => {
    expect(parseAuditMetadata(action, metadata)).toEqual(metadata);
  });

  it("rejects unknown metadata fields instead of persisting full DTO payloads", () => {
    expect(() =>
      parseAuditMetadata("owner.updated", {
        changedFields: ["name"],
        dto: { name: "Owner Name" }
      })
    ).toThrow("Invalid audit metadata for action owner.updated.");
  });

  it("redacts sensitive values while preserving safe changed-field descriptors", () => {
    const metadata = redactAuditMetadata({
      changedFields: ["taxId", "paymentDetails", "name"],
      taxId: "20-12345678-9",
      paymentDetails: { account: "secret-account" },
      name: "Owner Name"
    });

    expect(metadata).toEqual({
      changedFields: ["taxId", "paymentDetails", "name"],
      taxId: REDACTED_AUDIT_VALUE,
      paymentDetails: REDACTED_AUDIT_VALUE,
      name: "Owner Name"
    });
  });

  it("builds valid changed-field metadata without raw sensitive values", () => {
    const metadata = buildChangedFieldsMetadata({
      name: "Owner Name",
      identityNumber: "12345678",
      guaranteeInfo: "private guarantor details"
    });

    expect(metadata).toEqual({ changedFields: ["guaranteeInfo", "identityNumber", "name"] });
    expect(parseAuditMetadata("renter.updated", metadata)).toEqual(metadata);
  });
});
