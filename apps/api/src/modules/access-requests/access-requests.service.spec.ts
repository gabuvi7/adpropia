import { BadRequestException } from "@nestjs/common";
import type { AccessRequestInput } from "@adpropia/shared";
import { describe, expect, it, vi } from "vitest";
import { AccessRequestsService } from "./access-requests.service";

const validInput: AccessRequestInput = {
  companyName: "Inmobiliaria Centro",
  contactName: "Martina Díaz",
  email: "martina@example.com",
  phone: "+54 11 5555-5555",
  rentalAdministrationUnits: 125,
  saleUnits: 8,
  users: 4,
  selectedModules: ["RENTALS_AND_CONTRACTS", "SALE_UNIT_MANAGEMENT"],
  turnstileToken: "valid-token"
};

function createService(overrides?: { turnstileOk?: boolean }) {
  const prisma = {
    accessRequest: {
      create: vi.fn().mockResolvedValue({ id: "access-request-1", recommendedPlan: "PROFESIONAL" }),
      update: vi.fn().mockResolvedValue({ id: "access-request-1" })
    }
  };
  const resend = {
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: "email-1" }, error: null })
    }
  };
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({
      success: overrides?.turnstileOk ?? true,
      challenge_ts: "2026-06-11T20:00:00.000Z",
      hostname: "adpropia.com.ar"
    })
  });

  const service = new AccessRequestsService(
    prisma as never,
    resend as never,
    {
      get: vi.fn((key: string) => {
        if (key === "TURNSTILE_SECRET_KEY") return "turnstile-secret";
        if (key === "RESEND_API_KEY") return "resend-key";
        if (key === "ACCESS_REQUEST_EMAIL_TO") return "guviedo@adpropia.com.ar";
        if (key === "RESEND_FROM_EMAIL") return "AdPropIA <no-reply@adpropia.com.ar>";
        return undefined;
      })
    } as never,
    fetchMock as never
  );

  return { service, prisma, resend, fetchMock };
}

describe("AccessRequestsService", () => {
  it("rejects failed Turnstile verification without persistence or notification", async () => {
    const { service, prisma, resend } = createService({ turnstileOk: false });

    await expect(service.submit(validInput)).rejects.toThrow(BadRequestException);

    expect(prisma.accessRequest.create).not.toHaveBeenCalled();
    expect(resend.emails.send).not.toHaveBeenCalled();
  });

  it("persists a valid access request with the shared plan recommendation and sends the internal email", async () => {
    const { service, prisma, resend } = createService();

    const result = await service.submit(validInput);

    expect(result).toEqual({ id: "access-request-1", recommendedPlan: "PROFESIONAL" });
    expect(prisma.accessRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyName: "Inmobiliaria Centro",
        email: "martina@example.com",
        saleUnits: 8,
        recommendedPlan: "PROFESIONAL",
        selectedModules: ["RENTALS_AND_CONTRACTS", "SALE_UNIT_MANAGEMENT"]
      }),
      select: { id: true, recommendedPlan: true }
    });
    expect(resend.emails.send).toHaveBeenCalledWith(expect.objectContaining({
      to: "guviedo@adpropia.com.ar",
      subject: expect.stringContaining("Inmobiliaria Centro")
    }));
    expect(prisma.accessRequest.update).toHaveBeenCalledWith({
      where: { id: "access-request-1" },
      data: { notificationSentAt: expect.any(Date) }
    });
  });
});
