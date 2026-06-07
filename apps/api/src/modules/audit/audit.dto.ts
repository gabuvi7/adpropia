import { BadRequestException } from "@nestjs/common";
import { z } from "zod";

const optionalTrimmedString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional()
);

const optionalDate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce.date().optional()
);

export const auditLogQuerySchema = z
  .object({
    tenantId: optionalTrimmedString,
    entityType: optionalTrimmedString,
    entityId: optionalTrimmedString,
    action: optionalTrimmedString,
    userId: optionalTrimmedString,
    from: optionalDate,
    to: optionalDate,
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50)
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: "from must be earlier than or equal to to.",
    path: ["from"]
  });

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

export function parseAuditLogQuery(query: unknown): AuditLogQuery {
  const result = auditLogQuerySchema.safeParse(query);

  if (!result.success) {
    throw new BadRequestException({
      message: "Invalid audit log query.",
      errors: result.error.issues.map((issue) => issue.message)
    });
  }

  return result.data;
}
