import { describe, expect, it } from "vitest";
import {
  REDACTED_AUDIT_VALUE,
  buildChangedFieldsMetadata,
  parseAuditMetadata,
  redactAuditMetadata
} from "./metadata";

describe("audit metadata conventions", () => {
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
