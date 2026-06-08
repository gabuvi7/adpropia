-- Persona identity foundation for tenant-scoped rental parties.

CREATE TYPE "PersonaKind" AS ENUM ('FISICA', 'JURIDICA');

CREATE TABLE "personas" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "kind" "PersonaKind" NOT NULL,
  "displayName" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "personas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "persona_fisicas" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "personaId" TEXT NOT NULL,
  "firstName" TEXT,
  "lastName" TEXT,
  "dni" TEXT,
  "cuit" TEXT,
  "dateOfBirth" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "persona_fisicas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "persona_fisicas_identity_required" CHECK ("dni" IS NOT NULL OR "cuit" IS NOT NULL)
);

CREATE TABLE "persona_juridicas" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "personaId" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "cuit" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "persona_juridicas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "personas_id_tenantId_key" ON "personas"("id", "tenantId");
CREATE INDEX "personas_tenantId_idx" ON "personas"("tenantId");
CREATE INDEX "personas_tenantId_displayName_idx" ON "personas"("tenantId", "displayName");
CREATE INDEX "personas_tenantId_kind_idx" ON "personas"("tenantId", "kind");

CREATE UNIQUE INDEX "persona_fisicas_personaId_key" ON "persona_fisicas"("personaId");
CREATE UNIQUE INDEX "persona_fisicas_personaId_tenantId_key" ON "persona_fisicas"("personaId", "tenantId");
CREATE UNIQUE INDEX "persona_fisicas_tenantId_dni_key" ON "persona_fisicas"("tenantId", "dni");
CREATE UNIQUE INDEX "persona_fisicas_tenantId_cuit_key" ON "persona_fisicas"("tenantId", "cuit");
CREATE INDEX "persona_fisicas_tenantId_idx" ON "persona_fisicas"("tenantId");

CREATE UNIQUE INDEX "persona_juridicas_personaId_key" ON "persona_juridicas"("personaId");
CREATE UNIQUE INDEX "persona_juridicas_personaId_tenantId_key" ON "persona_juridicas"("personaId", "tenantId");
CREATE UNIQUE INDEX "persona_juridicas_tenantId_cuit_key" ON "persona_juridicas"("tenantId", "cuit");
CREATE INDEX "persona_juridicas_tenantId_idx" ON "persona_juridicas"("tenantId");

ALTER TABLE "personas"
  ADD CONSTRAINT "personas_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "persona_fisicas"
  ADD CONSTRAINT "persona_fisicas_personaId_tenantId_fkey"
  FOREIGN KEY ("personaId", "tenantId") REFERENCES "personas"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "persona_juridicas"
  ADD CONSTRAINT "persona_juridicas_personaId_tenantId_fkey"
  FOREIGN KEY ("personaId", "tenantId") REFERENCES "personas"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
