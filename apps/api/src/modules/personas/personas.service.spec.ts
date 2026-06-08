import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../common/prisma";
import type { RequestContextService } from "../../common/request-context/request-context.service";
import { createPersonaSchema } from "./personas.dto";
import { PersonasRepository } from "./personas.repository";

function createContextMock(tenantId = "tenant-a") {
  return {
    get: () => ({ requestId: "req-1", userId: "user-1", tenantId, role: "ADMIN" })
  } as RequestContextService;
}

function createPrismaMock() {
  return {
    persona: {
      create: vi.fn(),
      findFirst: vi.fn()
    },
    $transaction: vi.fn()
  } as unknown as PrismaService;
}

function mockTransaction(prisma: PrismaService, tx: unknown) {
  vi.mocked(prisma.$transaction as unknown as (cb: (tx: unknown) => unknown) => unknown).mockImplementation(
    async (callback: (tx: unknown) => unknown) => callback(tx)
  );
}

describe("Persona identity foundation", () => {
  it("rejects a natural person without DNI or CUIT", () => {
    const result = createPersonaSchema.safeParse({
      displayName: "Ana Gómez",
      kind: "FISICA",
      fisica: {}
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain("Una persona física debe incluir DNI y/o CUIT.");
  });

  it("accepts a natural person with DNI only or CUIT only", () => {
    const withDni = createPersonaSchema.safeParse({
      displayName: "Ana Gómez",
      kind: "FISICA",
      fisica: { dni: "12345678" }
    });
    const withCuit = createPersonaSchema.safeParse({
      displayName: "Juan Pérez",
      kind: "FISICA",
      fisica: { cuit: "20-12345678-9" }
    });

    expect(withDni.success).toBe(true);
    expect(withCuit.success).toBe(true);
  });

  it("rejects a legal person without CUIT", () => {
    const result = createPersonaSchema.safeParse({
      displayName: "Acme SA",
      kind: "JURIDICA",
      juridica: { legalName: "Acme SA" }
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain("Una persona jurídica debe incluir CUIT.");
  });

  it("creates personas only with the active tenantId", async () => {
    const prisma = createPrismaMock();
    const tx = {
      persona: {
        create: vi.fn().mockResolvedValue({ id: "persona-1", tenantId: "tenant-b", displayName: "Ana Gómez" } as never)
      }
    };
    mockTransaction(prisma, tx);
    const repository = new PersonasRepository(prisma, createContextMock("tenant-b"));

    await repository.create({ displayName: "Ana Gómez", kind: "FISICA", fisica: { dni: "12345678" } });

    expect(tx.persona.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenant: { connect: { id: "tenant-b" } },
        displayName: "Ana Gómez",
        fisica: { create: expect.objectContaining({ dni: "12345678" }) }
      }),
      include: { fisica: true, juridica: true }
    });
  });

  it("looks up personas by id and tenantId, never by id alone", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.persona.findFirst).mockResolvedValue({ id: "persona-1", tenantId: "tenant-c" } as never);
    const repository = new PersonasRepository(prisma, createContextMock("tenant-c"));

    await repository.findById("persona-1");

    expect(prisma.persona.findFirst).toHaveBeenCalledWith({
      where: { id: "persona-1", tenantId: "tenant-c", deletedAt: null },
      include: { fisica: true, juridica: true }
    });
  });

  it("blocks cross-tenant persona linking", async () => {
    const prisma = createPrismaMock();
    vi.mocked(prisma.persona.findFirst).mockResolvedValue(null as never);
    const repository = new PersonasRepository(prisma, createContextMock("tenant-b"));

    await expect(repository.assertBelongsToTenant("persona-from-tenant-a")).rejects.toThrow(BadRequestException);
  });
});
