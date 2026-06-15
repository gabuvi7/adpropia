import { z } from "zod";

export const REDACTED_AUDIT_VALUE = "[REDACTED]";

const sensitiveAuditMetadataKeys = [
  "accessToken",
  "credential",
  "credentials",
  "dto",
  "fullPayload",
  "guaranteeInfo",
  "identityNumber",
  "notes",
  "password",
  "paymentDetails",
  "rawPayload",
  "refreshToken",
  "secret",
  "taxId",
  "token"
] as const;

const allowedRedactedAuditMetadataKeys = sensitiveAuditMetadataKeys.filter(
  (key) => !["dto", "fullPayload", "rawPayload"].includes(key)
);

const safeString = z.string().trim().min(1);
const safeStringArray = z.array(safeString);

const redactedSensitiveFieldsSchema = Object.fromEntries(
  allowedRedactedAuditMetadataKeys.map((key) => [key, z.literal(REDACTED_AUDIT_VALUE).optional()])
) as Partial<
  Record<(typeof sensitiveAuditMetadataKeys)[number], z.ZodOptional<z.ZodLiteral<typeof REDACTED_AUDIT_VALUE>>>
>;

const businessAuditMetadataSchema = z
  .object({
    action: safeString.optional(),
    adjustmentId: safeString.optional(),
    adjustmentsCount: z.number().int().min(0).optional(),
    amount: safeString.optional(),
    amountCents: z.number().int().optional(),
    changedFields: safeStringArray.optional(),
    concept: safeString.optional(),
    contractId: safeString.optional(),
    currency: safeString.optional(),
    entityId: safeString.optional(),
    estimatedIndexSource: safeString.nullable().optional(),
    from: safeString.optional(),
    finalizationReason: safeString.optional(),
    generatedPeriods: z.number().int().min(0).optional(),
    lineItemsCount: z.number().int().min(0).optional(),
    name: safeString.optional(),
    newStatus: safeString.optional(),
    ownerId: safeString.optional(),
    ownerPersonaIds: safeStringArray.optional(),
    participantPersonaIds: safeStringArray.optional(),
    periodEnd: safeString.optional(),
    periodStart: safeString.optional(),
    propertyId: safeString.optional(),
    propertyIds: safeStringArray.optional(),
    renterId: safeString.optional(),
    rentPeriodId: safeString.optional(),
    role: safeString.optional(),
    serviceTypeIds: safeStringArray.optional(),
    sign: z.enum(["CREDIT", "DEBIT"]).optional(),
    slug: safeString.optional(),
    state: safeString.optional(),
    status: safeString.optional(),
    to: safeString.optional(),
    type: safeString.optional(),
    userId: safeString.optional(),
    ...redactedSensitiveFieldsSchema
  })
  .strict();

export const businessAuditActions = [
  "admin-provisioning.auth0-org.linked",
  "admin-provisioning.auth0-subject.linked",
  "admin-provisioning.membership.provisioned",
  "contract.created",
  "contract.deposit_pact_defined",
  "contract.early_finalized",
  "contract.guarantee_registered",
  "contract.schedule_activated",
  "contract.status.changed",
  "contract.structure_created",
  "contract.updated",
  "liquidation.adjustment.added",
  "liquidation.adjustment.removed",
  "liquidation.created",
  "liquidation.status.changed",
  "owner.created",
  "owner.updated",
  "payment.created",
  "property.created",
  "property.ownership_updated",
  "property.status.changed",
  "property.updated",
  "rent_payment.recorded",
  "renter.created",
  "renter.updated",
  "tenant_balance_movement.recorded",
  "tenant.created",
  "tenant_settings.updated"
] as const;

export type BusinessAuditAction = (typeof businessAuditActions)[number];
export type BusinessAuditMetadata = z.infer<typeof businessAuditMetadataSchema>;

const businessAuditActionSet = new Set<string>(businessAuditActions);
const sensitiveAuditMetadataKeySet = new Set<string>(sensitiveAuditMetadataKeys);

export function parseAuditMetadata(action: string, metadata: unknown): BusinessAuditMetadata | undefined {
  if (metadata === undefined) {
    return undefined;
  }

  if (!businessAuditActionSet.has(action)) {
    throw new Error(`Unknown audit action ${action}.`);
  }

  const result = businessAuditMetadataSchema.safeParse(metadata);

  if (!result.success) {
    throw new Error(`Invalid audit metadata for action ${action}.`);
  }

  return result.data;
}

export function redactAuditMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      key,
      isSensitiveAuditMetadataKey(key) ? REDACTED_AUDIT_VALUE : value
    ])
  );
}

export function buildChangedFieldsMetadata(input: Record<string, unknown>): Pick<BusinessAuditMetadata, "changedFields"> {
  return { changedFields: Object.keys(input).sort() };
}

export function isSensitiveAuditMetadataKey(key: string): boolean {
  return sensitiveAuditMetadataKeySet.has(key);
}
