import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../common/prisma";
import type { RequestContextService } from "../../common/request-context/request-context.service";
import { parseRequestBody } from "../../common/validation/zod-validation";
import type { AuditService } from "../audit/audit.service";
import { updateTenantSettingsSchema } from "./tenants.dto";
import { TenantsService } from "./tenants.service";

function createPrismaMock() {
  return {
    tenant: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn()
    },
    tenantSettings: {
      findUnique: vi.fn(),
      update: vi.fn()
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

function createContextMock(overrides?: Partial<{ tenantId: string; role: "READONLY" | "OPERATOR" | "ADMIN" | "OWNER" | "SUPERADMIN" }>): RequestContextService {
  const ctx = { requestId: "req-1", userId: "user-1", tenantId: "tenant-1", role: "ADMIN" as const, ...overrides };
  return {
    get: () => ctx
  } as unknown as RequestContextService;
}

function mockTransaction(prisma: PrismaService, tx: unknown) {
  vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
    async (callback: (tx: unknown) => unknown) => callback(tx)
  );
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

  it("updates current tenant settings and writes safe audit metadata", async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    vi.mocked(prisma.tenantSettings.findUnique).mockResolvedValue({ id: "pre-transaction-settings", tenantId: "tenant-a" } as never);
    const tx = {
      tenantSettings: { update: vi.fn().mockResolvedValue({ id: "settings-1", tenantId: "tenant-a" } as never) },
      tenant: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "tenant-a",
          settings: { id: "settings-1", commercialName: "Nueva Marca", defaultCommissionBps: 500 }
        } as never)
      }
    };
    mockTransaction(prisma, tx);
    const service = new TenantsService(prisma, audit, createContextMock({ tenantId: "tenant-a", role: "ADMIN" }));

    await service.updateCurrentTenantSettings({ commercialName: "Nueva Marca", defaultCommissionBps: 500 });

    expect(prisma.tenantSettings.findUnique).toHaveBeenCalledWith({ where: { tenantId: "tenant-a" } });
    expect(tx.tenantSettings.update).toHaveBeenCalledWith({
      where: { tenantId: "tenant-a" },
      data: { commercialName: "Nueva Marca", defaultCommissionBps: 500 }
    });
    expect(tx.tenant.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: "tenant-a" }, include: { settings: true } });
    expect(audit.createEntryWithClient).toHaveBeenCalledWith(tx, expect.objectContaining({ tenantId: "tenant-a" }), {
      tenantId: "tenant-a",
      entityType: "tenant_settings",
      entityId: "settings-1",
      action: "tenant_settings.updated",
      metadata: { changedFields: ["commercialName", "defaultCommissionBps"] }
    });
  });

  it("rejects tenant settings updates for unauthorized roles", async () => {
    const prisma = createPrismaMock();
    const service = new TenantsService(prisma, createAuditMock(), createContextMock({ tenantId: "tenant-a", role: "OPERATOR" }));

    await expect(service.updateCurrentTenantSettings({ commercialName: "Nueva Marca" })).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.tenantSettings.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("scopes settings updates to the current tenant", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.tenantSettings.findUnique).mockResolvedValue({ id: "settings-b", tenantId: "tenant-b" } as never);
    const tx = {
      tenantSettings: { update: vi.fn().mockResolvedValue({ id: "settings-b", tenantId: "tenant-b" } as never) },
      tenant: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "tenant-b", settings: { id: "settings-b" } } as never) }
    };
    mockTransaction(prisma, tx);
    const service = new TenantsService(prisma, createAuditMock(), createContextMock({ tenantId: "tenant-b", role: "OWNER" }));

    await service.updateCurrentTenantSettings({ defaultCurrency: "USD" });

    expect(prisma.tenantSettings.findUnique).toHaveBeenCalledWith({ where: { tenantId: "tenant-b" } });
    expect(tx.tenantSettings.update).toHaveBeenCalledWith({
      where: { tenantId: "tenant-b" },
      data: { defaultCurrency: "USD" }
    });
  });

  it("throws NotFound when current tenant settings do not exist", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.tenantSettings.findUnique).mockResolvedValue(null as never);
    const service = new TenantsService(prisma, createAuditMock(), createContextMock({ tenantId: "tenant-missing", role: "ADMIN" }));

    await expect(service.updateCurrentTenantSettings({ commercialName: "Nueva Marca" })).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.tenantSettings.findUnique).toHaveBeenCalledWith({ where: { tenantId: "tenant-missing" } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects unsupported tenant settings fields", () => {
    expect(() => parseRequestBody(updateTenantSettingsSchema, { legalIdentity: { taxId: "secret" } })).toThrow(BadRequestException);
    expect(() => parseRequestBody(updateTenantSettingsSchema, { rawPayload: { commercialName: "Nueva Marca" } })).toThrow(BadRequestException);
  });
});
