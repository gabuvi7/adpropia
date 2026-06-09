import { describe, expect, it, vi } from "vitest";
import {
  buildBootstrapAuth0SmokePlan,
  parseBootstrapAuth0SmokeEnv,
  runBootstrapAuth0Smoke
} from "./bootstrap-auth0-smoke";

const validEnv = {
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://localhost/adpropia",
  AUTH0_ORG_ID: "org_abc123",
  AUTH0_USER_ID: "auth0|user_xyz",
  AUTH0_USER_EMAIL: "agent@example.com",
  AUTH0_USER_NAME: "Smoke Agent",
  TENANT_NAME: "Smoke Agency",
  TENANT_SLUG: "smoke-agency",
  TENANT_ROLE: "ADMIN"
};

describe("bootstrap-auth0-smoke", () => {
  it("parses explicit smoke env without exposing secrets", () => {
    const input = parseBootstrapAuth0SmokeEnv({ ...validEnv, AUTH0_CLIENT_SECRET: "do-not-print" });

    expect(input).toEqual({
      auth0OrgId: "org_abc123",
      auth0UserId: "auth0|user_xyz",
      email: "agent@example.com",
      name: "Smoke Agent",
      tenantName: "Smoke Agency",
      tenantSlug: "smoke-agency",
      role: "ADMIN"
    });
  });

  it("refuses production runtime", () => {
    expect(() => parseBootstrapAuth0SmokeEnv({ ...validEnv, NODE_ENV: "production" })).toThrow("Refusing to run");
  });

  it("requires safe explicit identifiers", () => {
    expect(() => parseBootstrapAuth0SmokeEnv({ ...validEnv, AUTH0_ORG_ID: "" })).toThrow("AUTH0_ORG_ID");
    expect(() => parseBootstrapAuth0SmokeEnv({ ...validEnv, AUTH0_USER_EMAIL: "not-an-email" })).toThrow("AUTH0_USER_EMAIL");
    expect(() => parseBootstrapAuth0SmokeEnv({ ...validEnv, TENANT_ROLE: "SUPERADMIN" })).toThrow("TENANT_ROLE");
  });

  it("builds an idempotent upsert plan for tenant, user, and membership", () => {
    const plan = buildBootstrapAuth0SmokePlan(parseBootstrapAuth0SmokeEnv(validEnv));

    expect(plan).toEqual({
      tenant: {
        where: { auth0OrgId: "org_abc123" },
        create: { auth0OrgId: "org_abc123", name: "Smoke Agency", slug: "smoke-agency", status: "ACTIVE" },
        update: { name: "Smoke Agency", slug: "smoke-agency", status: "ACTIVE" }
      },
      user: {
        where: { auth0UserId: "auth0|user_xyz" },
        create: { auth0UserId: "auth0|user_xyz", email: "agent@example.com", name: "Smoke Agent", isActive: true },
        update: { email: "agent@example.com", name: "Smoke Agent", isActive: true }
      },
      membershipRole: "ADMIN"
    });
  });

  it("upserts tenant, user, and tenant membership without duplicates", async () => {
    const prisma = {
      tenant: { upsert: vi.fn().mockResolvedValue({ id: "tenant-1", slug: "smoke-agency" }) },
      user: { upsert: vi.fn().mockResolvedValue({ id: "user-1", email: "agent@example.com" }) },
      tenantUser: { upsert: vi.fn().mockResolvedValue({ id: "membership-1", role: "ADMIN", isActive: true }) },
      $disconnect: vi.fn()
    };
    const log = vi.fn();

    const result = await runBootstrapAuth0Smoke({ env: validEnv, prisma: prisma as never, log });

    expect(prisma.tenant.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { auth0OrgId: "org_abc123" } }));
    expect(prisma.user.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { auth0UserId: "auth0|user_xyz" } }));
    expect(prisma.tenantUser.upsert).toHaveBeenCalledWith({
      where: { tenantId_userId: { tenantId: "tenant-1", userId: "user-1" } },
      create: { tenantId: "tenant-1", userId: "user-1", role: "ADMIN", isActive: true, acceptedAt: expect.any(Date) },
      update: { role: "ADMIN", isActive: true, acceptedAt: expect.any(Date) }
    });
    expect(result).toEqual({ tenantId: "tenant-1", tenantSlug: "smoke-agency", userId: "user-1", role: "ADMIN", membershipId: "membership-1" });
    expect(log.mock.calls.flat().join(" ")).not.toContain("do-not-print");
  });
});
