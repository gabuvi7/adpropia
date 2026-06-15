import { describe, expect, it } from "vitest";
import { upcomingAdjustmentsQuerySchema } from "./reports.dto";

describe("reports DTO validation", () => {
  it("validates upcoming adjustment date ranges with Spanish messages", () => {
    const invalidIsoDate = upcomingAdjustmentsQuerySchema.safeParse({ from: "not-a-date" });
    expect(invalidIsoDate.success).toBe(false);
    expect(invalidIsoDate.error?.issues.map((issue) => issue.message)).toContain("La fecha desde debe ser una fecha ISO válida.");

    const invalidRange = upcomingAdjustmentsQuerySchema.safeParse({
      from: "2026-10-31T00:00:00.000Z",
      to: "2026-10-01T00:00:00.000Z"
    });
    expect(invalidRange.success).toBe(false);
    expect(invalidRange.error?.issues.map((issue) => issue.message)).toContain("El rango de fechas no es válido.");
  });

  it.each(["contractId", "renterId", "propertyId"] as const)(
    "validates invalid upcoming adjustment %s with a Spanish message",
    (field) => {
      const result = upcomingAdjustmentsQuerySchema.safeParse({ [field]: 123 });

      expect(result.success).toBe(false);
      expect(result.error?.issues.map((issue) => issue.message)).toContain("El identificador debe ser texto.");
    }
  );

  it.each(["contractId", "renterId", "propertyId"] as const)(
    "validates blank upcoming adjustment %s with a Spanish message",
    (field) => {
      const result = upcomingAdjustmentsQuerySchema.safeParse({ [field]: "   " });

      expect(result.success).toBe(false);
      expect(result.error?.issues.map((issue) => issue.message)).toContain("El identificador no puede estar vacío.");
    }
  );
});
