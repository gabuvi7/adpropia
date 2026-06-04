import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../common/prisma";
import type { RequestContextService } from "../../common/request-context/request-context.service";
import type { AuditService } from "../audit/audit.service";
import { TenantsService } from "./tenants.service";

function createPrismaMock() {
  return {
    tenant: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn()
    },
    $transaction: vi.fn()
  } as unknown as PrismaService;
}

function createAuditMock(): AuditService {
  return {
    createEntry: vi.fn().mockResolvedValue({}),
    createEntryWithClient: vi.fn().mockResolvedValue({})
  } as unknown as AuditService;
}

function createContextMock(overrides?: Partial<{ tenantId: string }>): RequestContextService {
  const ctx = { requestId: "req-1", userId: "user-1", tenantId: "tenant-1", role: "ADMIN" as const, ...overrides };
  return {
    get: () => ctx
  } as unknown as RequestContextService;
}

describe("TenantsService", () => {
  it("creates a tenant with settings and writes audit log", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const tx = { tenant: { create: vi.fn().mockResolvedValue({ id: "tenant-1", slug: "inmobiliaria-sur", name: "Inmobiliaria Sur" } as never) } };
    vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
      async (callback: (tx: unknown) => unknown) => callback(tx)
    );
    const service = new TenantsService(prisma, audit, createContextMock());

    await service.createTenant({
      name: "Inmobiliaria Sur",
      slug: "inmobiliaria-sur",
      settings: {
        commercialName: "Inmobiliaria Sur",
        defaultCurrency: "ARS",
        defaultCommissionBps: 0
      }
    });

    expect(tx.tenant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Inmobiliaria Sur",
          slug: "inmobiliaria-sur",
          settings: { create: expect.objectContaining({ commercialName: "Inmobiliaria Sur" }) }
        }),
        include: { settings: true }
      })
    );
    expect(audit.createEntryWithClient).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ tenantId: "tenant-1" }),
      expect.objectContaining({ tenantId: "tenant-1", action: "tenant.created", entityType: "tenant", entityId: "tenant-1" })
    );
  });

  it("lists tenants with settings", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.tenant.findMany).mockResolvedValue([] as never);
    const service = new TenantsService(prisma, createAuditMock(), createContextMock());

    await service.listTenants();

    expect(prisma.tenant.findMany).toHaveBeenCalledWith({ include: { settings: true }, orderBy: { createdAt: "desc" } });
  });

  it("gets a tenant by id with settings", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.tenant.findUnique).mockResolvedValue({ id: "tenant-1" } as never);
    const service = new TenantsService(prisma, createAuditMock(), createContextMock());

    await service.getTenantById("tenant-1");

    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({ where: { id: "tenant-1" }, include: { settings: true } });
  });
});
